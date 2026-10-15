"use client";

// Design Ref: §1.1~1.3, §1.4, §2 단계 1~9 — PDF 올리기 + 요약 시작 + 진행 표시 + 사건 카드.
// PDF는 브라우저 안에서 글자로 바꾸고, 글자만 서버(/api/summarize)로 보낸다. 서버는 끝난 사건부터 한 줄씩 보낸다.
// Plan SC: PDF 원본은 서버로 보내지 않는다 (PRD 7번)
import { useRef, useState } from "react";
import { extractPages } from "@/lib/pdf";
import { LIMITS } from "@/lib/limits";
import type { ComparisonResult, StreamMessage, SummarizedEvent } from "@/lib/schema";
import ComparePicker from "./ComparePicker";
import ResultView, { type ResultMeta } from "./ResultView";
import SavePanel from "./SavePanel";

type Status =
  | { kind: "idle" }
  | { kind: "reading"; done: number; total: number }
  | { kind: "summarizing"; message: string }
  | { kind: "done" }
  | { kind: "error"; message: string };

function isPdf(file: File): boolean {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

export default function UploadForm() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [events, setEvents] = useState<SummarizedEvent[]>([]);
  const [meta, setMeta] = useState<ResultMeta | null>(null);
  const [comparison, setComparison] = useState<ComparisonResult | null>(null);
  const [savedCount, setSavedCount] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  const busy = status.kind === "reading" || status.kind === "summarizing";
  const canSubmit = file !== null && !busy;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) return;

    setEvents([]);
    setMeta(null);
    setComparison(null);

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

    // 3) 글자만 서버로 보내고, 끝난 사건부터 받아서 화면에 붙인다 (PDF 원본은 보내지 않음)
    const controller = new AbortController();
    abortRef.current = controller;
    setStatus({ kind: "summarizing", message: "서버로 보내는 중…" });

    const collected: SummarizedEvent[] = [];
    let finished = false;

    const handleMessage = (message: StreamMessage) => {
      switch (message.type) {
        case "meta":
          setMeta({ edition: message.edition, date: message.date, articleCount: message.articleCount });
          break;
        case "progress":
          setStatus({ kind: "summarizing", message: message.message });
          break;
        case "event":
          collected.push(message.event);
          setEvents([...collected]);
          break;
        case "done":
          finished = true;
          setStatus({ kind: "done" });
          break;
        case "error":
          finished = true;
          setStatus({ kind: "error", message: message.message });
          break;
      }
    };

    try {
      const response = await fetch("/api/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pages }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        const data: unknown = await response.json().catch(() => null);
        const serverMessage =
          typeof data === "object" && data !== null && "error" in data
            ? String((data as { error: unknown }).error)
            : "요청에 실패했어요. 다시 시도해 주세요";
        setStatus({ kind: "error", message: serverMessage });
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let newline = buffer.indexOf("\n");
        while (newline >= 0) {
          const line = buffer.slice(0, newline).trim();
          buffer = buffer.slice(newline + 1);
          if (line) handleMessage(JSON.parse(line) as StreamMessage);
          newline = buffer.indexOf("\n");
        }
      }

      if (!finished) {
        setStatus({ kind: "error", message: "서버 응답이 중간에 끊겼어요. 다시 시도해 주세요" });
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setStatus({ kind: "error", message: "취소했어요" });
      } else {
        setStatus({ kind: "error", message: "서버에 연결하지 못했어요. 다시 시도해 주세요" });
      }
    } finally {
      abortRef.current = null;
    }
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="flex max-w-xl flex-col gap-6" noValidate>
        <div className="flex flex-col gap-2">
          <label htmlFor="pdf-file" className="text-sm font-medium">
            ① 스크랩 PDF
          </label>
          <input
            id="pdf-file"
            type="file"
            accept="application/pdf,.pdf"
            disabled={busy}
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setStatus({ kind: "idle" });
              setEvents([]);
              setMeta(null);
              setComparison(null);
            }}
            className="block w-full text-sm file:mr-4 file:rounded-full file:border-0 file:bg-black file:px-4 file:py-2 file:text-white dark:file:bg-zinc-50 dark:file:text-black"
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={!canSubmit}
            className="w-fit rounded-full bg-black px-6 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40 dark:bg-zinc-50 dark:text-black"
          >
            ② 요약 시작
          </button>
          {status.kind === "summarizing" && (
            <button
              type="button"
              onClick={() => abortRef.current?.abort()}
              className="rounded-full border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700"
            >
              취소
            </button>
          )}
        </div>

        <div aria-live="polite">
          {status.kind === "reading" && (
            <p>
              {status.total > 0 ? `PDF 읽는 중 (${status.done}/${status.total}쪽)` : "PDF 여는 중…"}
            </p>
          )}
          {status.kind === "summarizing" && <p>{status.message}</p>}
          {status.kind === "error" && (
            <p className="text-red-600 dark:text-red-400" role="alert">
              {status.message}
            </p>
          )}
        </div>
      </form>

      {(events.length > 0 || status.kind === "summarizing" || status.kind === "done") && (
        <ResultView
          events={events}
          meta={meta}
          finished={status.kind !== "summarizing"}
          comparison={comparison}
        />
      )}

      {status.kind === "done" && events.length > 0 && (
        <section className="mt-8 flex flex-col gap-6 border-t border-zinc-200 pt-6 dark:border-zinc-800" aria-label="저장과 비교">
          <SavePanel
            key={`${meta?.date ?? ""}|${meta?.edition ?? ""}`}
            events={events}
            defaultDate={meta?.date ?? null}
            defaultEdition={meta?.edition ?? null}
            onSaved={() => setSavedCount((c) => c + 1)}
          />
          <ComparePicker
            currentEvents={events}
            refreshKey={savedCount}
            comparison={comparison}
            onResult={setComparison}
          />
        </section>
      )}
    </>
  );
}
