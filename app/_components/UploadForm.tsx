"use client";

// Design Ref: §1.1, §1.4, §2 단계 1~3 — 회차 선택 + PDF 올리기 + 요약 시작.
// PDF는 브라우저 안에서 글자로 바꾸고, 글자만 서버(/api/summarize)로 보낸다.
// Plan SC: PDF 원본은 서버로 보내지 않는다 (PRD 7번)
import { useEffect, useRef, useState } from "react";
import { extractPages } from "@/lib/pdf";
import { EDITIONS, LIMITS, type Edition } from "@/lib/limits";

type Status =
  | { kind: "idle" }
  | { kind: "reading"; done: number; total: number }
  | { kind: "sending" }
  | { kind: "done"; edition: string; date: string; pageCount: number; charCount: number }
  | { kind: "error"; message: string };

type ReceiptResponse = {
  ok: true;
  edition: string;
  date: string;
  pageCount: number;
  charCount: number;
};

/** 브라우저 시간 기준 오늘 날짜 (YYYY-MM-DD) */
function todayString(): string {
  return new Date().toLocaleDateString("sv-SE");
}

function isPdf(file: File): boolean {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

export default function UploadForm() {
  const [edition, setEdition] = useState<Edition>("조간");
  const [file, setFile] = useState<File | null>(null);
  const [accessCode, setAccessCode] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const dateRef = useRef<HTMLInputElement>(null);

  // 서버에서 미리 그리는 화면에는 날짜를 넣지 않고, 브라우저가 열린 뒤에 오늘 날짜를 채운다
  useEffect(() => {
    if (dateRef.current && !dateRef.current.value) {
      dateRef.current.value = todayString();
    }
  }, []);

  const busy = status.kind === "reading" || status.kind === "sending";
  const canSubmit = file !== null && accessCode.length > 0 && !busy;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) return;

    const date = dateRef.current?.value || todayString();

    // 1) 파일 종류·크기 확인
    if (!isPdf(file)) {
      setStatus({ kind: "error", message: "PDF 파일만 올릴 수 있어요" });
      return;
    }
    if (file.size === 0) {
      setStatus({ kind: "error", message: "빈 파일이에요. 다른 PDF를 골라 주세요" });
      return;
    }
    if (file.size > LIMITS.maxFileMB * 1024 * 1024) {
      setStatus({ kind: "error", message: `파일이 너무 커요 (최대 ${LIMITS.maxFileMB}MB)` });
      return;
    }

    // 2) 브라우저 안에서 쪽별 글자 뽑기
    setStatus({ kind: "reading", done: 0, total: 0 });
    let pages;
    try {
      pages = await extractPages(file, (done, total) =>
        setStatus({ kind: "reading", done, total }),
      );
    } catch {
      setStatus({
        kind: "error",
        message: "PDF를 읽지 못했어요. 파일이 손상되었거나 암호가 걸려 있을 수 있어요",
      });
      return;
    }

    if (pages.length > LIMITS.maxPages) {
      setStatus({ kind: "error", message: `쪽수가 너무 많아요 (최대 ${LIMITS.maxPages}쪽)` });
      return;
    }
    if (pages.every((p) => p.text.length === 0)) {
      setStatus({
        kind: "error",
        message: "글자를 읽을 수 없는 PDF예요. 글자가 들어 있는 스크랩을 올려 주세요",
      });
      return;
    }

    // 3) 글자만 서버로 보내기 (PDF 원본은 보내지 않음)
    setStatus({ kind: "sending" });
    try {
      const response = await fetch("/api/summarize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-access-code": accessCode,
        },
        body: JSON.stringify({ edition, date, pages }),
      });

      const data: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        const serverMessage =
          typeof data === "object" && data !== null && "error" in data
            ? String((data as { error: unknown }).error)
            : "요청에 실패했어요. 다시 시도해 주세요";
        setStatus({ kind: "error", message: serverMessage });
        return;
      }

      const receipt = data as ReceiptResponse;
      setStatus({
        kind: "done",
        edition: receipt.edition,
        date: receipt.date,
        pageCount: receipt.pageCount,
        charCount: receipt.charCount,
      });
    } catch {
      setStatus({ kind: "error", message: "서버에 연결하지 못했어요. 다시 시도해 주세요" });
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-xl flex-col gap-6" noValidate>
      <fieldset className="flex flex-col gap-2" disabled={busy}>
        <legend className="mb-1 text-sm font-medium">① 회차와 날짜</legend>
        <div className="flex flex-wrap items-center gap-4">
          {EDITIONS.map((name) => (
            <label key={name} className="flex items-center gap-2">
              <input
                type="radio"
                name="edition"
                value={name}
                checked={edition === name}
                onChange={() => setEdition(name)}
              />
              {name}
            </label>
          ))}
          <input
            ref={dateRef}
            type="date"
            aria-label="날짜"
            className="rounded border border-zinc-300 bg-transparent px-2 py-1 text-sm dark:border-zinc-700"
          />
        </div>
      </fieldset>

      <div className="flex flex-col gap-2">
        <label htmlFor="pdf-file" className="text-sm font-medium">
          ② 스크랩 PDF
        </label>
        <input
          id="pdf-file"
          type="file"
          accept="application/pdf,.pdf"
          disabled={busy}
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            setStatus({ kind: "idle" });
          }}
          className="block w-full text-sm file:mr-4 file:rounded-full file:border-0 file:bg-black file:px-4 file:py-2 file:text-white dark:file:bg-zinc-50 dark:file:text-black"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="access-code" className="text-sm font-medium">
          접속 암호
        </label>
        <input
          id="access-code"
          type="password"
          autoComplete="off"
          value={accessCode}
          disabled={busy}
          onChange={(e) => setAccessCode(e.target.value)}
          className="rounded border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700"
        />
        <p className="text-xs text-zinc-500">서버에 설정한 암호를 입력해 주세요. 화면을 닫으면 지워져요.</p>
      </div>

      <button
        type="submit"
        disabled={!canSubmit}
        className="w-fit rounded-full bg-black px-6 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40 dark:bg-zinc-50 dark:text-black"
      >
        ③ 요약 시작
      </button>

      <div aria-live="polite">
        {status.kind === "reading" && (
          <p>
            {status.total > 0 ? `PDF 읽는 중 (${status.done}/${status.total}쪽)` : "PDF 여는 중…"}
          </p>
        )}
        {status.kind === "sending" && <p>서버로 보내는 중…</p>}
        {status.kind === "error" && (
          <p className="text-red-600 dark:text-red-400" role="alert">
            {status.message}
          </p>
        )}
        {status.kind === "done" && (
          <p role="status">
            서버가 받았어요: {status.date} {status.edition} · {status.pageCount}쪽 ·{" "}
            {status.charCount.toLocaleString()}자. 요약 기능은 다음 작업에서 이어 붙여요.
          </p>
        )}
      </div>
    </form>
  );
}
