"use client";

// Design Ref: §2 단계 1~2 — 브라우저 안에서 PDF를 읽어 쪽별 글자를 보여준다 (서버로 보내지 않음)
// Plan SC: 작업 1 — 기사 경계, 보도사 이름 위치, 쪽수 표시 방식, 글자 추출 가능 여부를 확인한다
import { useState } from "react";
import { extractPages, type PdfPage } from "@/lib/pdf";

type State =
  | { kind: "idle" }
  | { kind: "reading"; done: number; total: number }
  | { kind: "done"; fileName: string; pages: PdfPage[] }
  | { kind: "error"; message: string };

/** 줄 단위로 나눈다 (빈 줄 제외) */
function toLines(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

export default function PdfCheck() {
  const [state, setState] = useState<State>({ kind: "idle" });
  const [copied, setCopied] = useState(false);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setCopied(false);

    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setState({ kind: "error", message: "PDF 파일만 올릴 수 있어요." });
      return;
    }

    setState({ kind: "reading", done: 0, total: 0 });
    try {
      const pages = await extractPages(file, (done, total) =>
        setState({ kind: "reading", done, total }),
      );
      setState({ kind: "done", fileName: file.name, pages });
    } catch {
      setState({
        kind: "error",
        message: "PDF를 읽지 못했어요. 파일이 손상되었거나 암호가 걸려 있을 수 있어요.",
      });
    }
  }

  async function copyAll(pages: PdfPage[]) {
    const all = pages.map((p) => `===== ${p.page}쪽 =====\n${p.text}`).join("\n\n");
    try {
      await navigator.clipboard.writeText(all);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-10 text-black dark:text-zinc-50">
      <h1 className="text-3xl font-bold tracking-tight">PDF 구조 확인</h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">
        스크랩 PDF를 고르면 쪽마다 어떤 글자가 뽑히는지 보여줘요. 이 PDF는 내 브라우저 안에서만
        읽고, 서버로 보내지 않아요.
      </p>

      <label className="mt-6 block">
        <span className="mb-2 block text-sm font-medium">스크랩 PDF 선택</span>
        <input
          type="file"
          accept="application/pdf,.pdf"
          onChange={(e) => handleFile(e.target.files?.[0])}
          disabled={state.kind === "reading"}
          className="block w-full text-sm file:mr-4 file:rounded-full file:border-0 file:bg-black file:px-4 file:py-2 file:text-white dark:file:bg-zinc-50 dark:file:text-black"
        />
      </label>

      {state.kind === "reading" && (
        <p className="mt-6" role="status">
          {state.total > 0 ? `PDF 읽는 중 (${state.done}/${state.total}쪽)` : "PDF 여는 중…"}
        </p>
      )}

      {state.kind === "error" && (
        <p className="mt-6 text-red-600 dark:text-red-400" role="alert">
          {state.message}
        </p>
      )}

      {state.kind === "done" && <Result state={state} onCopy={copyAll} copied={copied} />}
    </main>
  );
}

function Result({
  state,
  onCopy,
  copied,
}: {
  state: Extract<State, { kind: "done" }>;
  onCopy: (pages: PdfPage[]) => void;
  copied: boolean;
}) {
  const { pages, fileName } = state;
  const emptyPages = pages.filter((p) => p.text.length === 0).map((p) => p.page);
  const withText = pages.length - emptyPages.length;

  let verdict: string;
  if (pages.length === 0) {
    verdict = "쪽이 없는 PDF예요.";
  } else if (withText === 0) {
    verdict = "글자가 하나도 뽑히지 않았어요. 그림만 있는 스캔본일 가능성이 커요.";
  } else if (emptyPages.length > 0) {
    verdict = `글자가 없는 쪽이 ${emptyPages.length}개 있어요 (${emptyPages.join(", ")}쪽). 그림이거나 스캔된 쪽일 수 있어요.`;
  } else {
    verdict = "모든 쪽에서 글자를 뽑았어요.";
  }

  return (
    <section className="mt-8">
      <h2 className="text-xl font-semibold">결과: {fileName}</h2>
      <ul className="mt-3 space-y-1 text-sm">
        <li>전체 {pages.length}쪽</li>
        <li>글자가 있는 쪽 {withText}쪽</li>
        <li className="font-medium">{verdict}</li>
      </ul>

      <button
        type="button"
        onClick={() => onCopy(pages)}
        className="mt-4 rounded-full border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700"
      >
        {copied ? "복사했어요" : "전체 글자 복사"}
      </button>

      <p className="mt-6 text-sm text-zinc-600 dark:text-zinc-400">
        쪽마다 &quot;첫 줄 3개&quot;와 &quot;마지막 줄&quot;을 보여줘요. 보도사 이름과 쪽수 표시가 어디에
        붙는지 살펴보세요. 펼치면 그 쪽의 전체 글자가 보여요.
      </p>

      <ol className="mt-4 space-y-3">
        {pages.map((p) => {
          const lines = toLines(p.text);
          return (
            <li
              key={p.page}
              className="rounded-lg border border-zinc-200 p-4 text-sm dark:border-zinc-800"
            >
              <div className="font-semibold">
                {p.page}쪽{" "}
                <span className="font-normal text-zinc-500">
                  (글자 {p.text.length}자 · {lines.length}줄)
                </span>
              </div>
              {lines.length === 0 ? (
                <p className="mt-2 text-red-600 dark:text-red-400">글자 없음</p>
              ) : (
                <div className="mt-2 space-y-1">
                  <div>
                    <span className="text-zinc-500">첫 줄 3개: </span>
                    {lines.slice(0, 3).join(" ⏎ ")}
                  </div>
                  <div>
                    <span className="text-zinc-500">마지막 줄: </span>
                    {lines[lines.length - 1]}
                  </div>
                </div>
              )}
              {lines.length > 0 && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-zinc-600 dark:text-zinc-400">
                    전체 글자 펼치기
                  </summary>
                  <pre className="mt-2 whitespace-pre-wrap break-words font-mono text-xs">
                    {p.text}
                  </pre>
                </details>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
