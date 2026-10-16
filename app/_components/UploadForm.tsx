"use client";

// Design Ref: §1.1~1.3, §1.4, §2 단계 1~11 — PDF 올리기 + 요약 시작 + 진행 표시 + 사건 카드 + 자동 저장 + 이어지는 사건 찾기.
// PDF는 브라우저 안에서 글자로 바꾸고, 글자만 서버(/api/summarize)로 보낸다. 서버는 끝난 사건부터 한 줄씩 보낸다.
// 요약이 끝나면 PDF 머리줄의 날짜·회차로 자동 저장하고, 최근 14일 기록에서 이어지는 사건을 AI로 찾는다 (/api/flow).
// Plan SC: PDF 원본은 서버로 보내지 않는다 (PRD 7번)
import { useRef, useState } from "react";
import { buildHistory, buildTimeline, DEFAULT_DAYS } from "@/lib/flow";
import { EDITIONS, LIMITS, type Edition } from "@/lib/limits";
import { extractPages } from "@/lib/pdf";
import type { CompactEvent, FlowInfo, FlowMatch, StreamMessage, SummarizedEvent } from "@/lib/schema";
import { hasSaved, isValidDate, saveRecord } from "@/lib/storage";
import HistoryBar, { type HistoryNote } from "./HistoryBar";
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

function isEdition(value: string): value is Edition {
  return (EDITIONS as readonly string[]).includes(value);
}

function toCompact(events: SummarizedEvent[]): CompactEvent[] {
  return events.map((e) => ({
    id: e.id,
    title: e.title,
    summary: e.summary,
    outlets: [...new Set(e.coverage.map((c) => c.outlet))],
  }));
}

export default function UploadForm() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [events, setEvents] = useState<SummarizedEvent[]>([]);
  const [meta, setMeta] = useState<ResultMeta | null>(null);
  const [flows, setFlows] = useState<Record<number, FlowInfo>>({});
  const [note, setNote] = useState<HistoryNote>(null);
  const [olderCount, setOlderCount] = useState(0);
  const [linking, setLinking] = useState(false);
  const [manualSave, setManualSave] = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  const busy = status.kind === "reading" || status.kind === "summarizing";
  const canSubmit = file !== null && !busy;

  function resetResult() {
    setEvents([]);
    setMeta(null);
    setFlows({});
    setNote(null);
    setOlderCount(0);
    setManualSave(false);
  }

  /**
   * 요약이 끝난 뒤: 최근 기록에서 이어지는 사건을 찾고, 그 연결과 함께 자동 저장한다.
   * days가 null이면 14일보다 더 예전 기록까지 찾는다 ("더 예전 기록까지 찾기").
   */
  async function linkAndSave(base: SummarizedEvent[], m: ResultMeta | null, days: number | null) {
    setNote(null);
    const date = m?.date ?? "";
    const editionText = m?.edition ?? "";

    // 스크랩에서 날짜·회차를 읽지 못하면 이름표를 정할 수 없어서 자동 저장하지 않는다
    if (!isValidDate(date) || !isEdition(editionText)) {
      setManualSave(true);
      setNote({
        kind: "info",
        message: "스크랩에서 날짜·회차를 읽지 못해 자동 저장하지 않았어요. 아래에서 직접 골라 저장하면 기록을 쌓을 수 있어요.",
      });
      return;
    }
    setManualSave(false);

    const edition: Edition = editionText;
    const overwrite = hasSaved(date, edition);
    const plain: SummarizedEvent[] = base.map((e) => {
      const copy = { ...e };
      delete copy.previous;
      return copy;
    });

    let linked: SummarizedEvent[] = plain;
    let flowError: string | null = null;
    let searched = false;

    const history = buildHistory(date, edition, days);
    setOlderCount(history.olderCount);

    if (history.events.length > 0) {
      searched = true;
      setLinking(true);
      try {
        const response = await fetch("/api/flow", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ current: toCompact(plain), history: history.events }),
        });
        const data: unknown = await response.json().catch(() => null);
        if (!response.ok || typeof data !== "object" || data === null || !("matches" in data)) {
          flowError =
            typeof data === "object" && data !== null && "error" in data
              ? String((data as { error: unknown }).error)
              : "이어지는 사건을 찾지 못했어요.";
        } else {
          const matches = (data as { matches: FlowMatch[] }).matches;
          linked = plain.map((e) => {
            const match = matches.find((x) => x.currentId === e.id);
            const target = match?.previousRef != null ? history.refs.get(match.previousRef) : undefined;
            return target
              ? { ...e, previous: { date: target.date, edition: target.edition, eventId: target.eventId, change: match?.change ?? "" } }
              : e;
          });
        }
      } catch {
        flowError = "서버에 연결하지 못해 이어지는 사건을 찾지 못했어요.";
      }
      setLinking(false);
    }

    // 자동 저장 (같은 날짜·회차가 있으면 덮어쓴다)
    const saved = saveRecord(date, edition, linked);
    setSavedCount((c) => c + 1);
    setEvents(linked);

    // 화면에 보여줄 흐름 (저장돼 있는 연결을 따라 거슬러 올라간다)
    if (searched && !flowError) {
      const next: Record<number, FlowInfo> = {};
      for (const e of linked) {
        next[e.id] = e.previous
          ? { linked: true, change: e.previous.change, steps: buildTimeline(e.previous) }
          : { linked: false, change: "", steps: [] };
      }
      setFlows(next);
    } else {
      setFlows({});
    }

    // 안내 문구
    const label = `${date} ${edition}`;
    if (!saved.ok) {
      setNote({
        kind: "error",
        message: "자동 저장하지 못했어요 (브라우저 저장 공간을 확인해 주세요). 이 결과는 다음 요약의 흐름에 쓰이지 않아요.",
      });
    } else if (flowError) {
      setNote({ kind: "error", message: `${flowError} 저장은 했어요 (${label}).` });
    } else if (!searched) {
      setNote({
        kind: "ok",
        message: `자동 저장했어요: ${label}${overwrite ? " (같은 날짜·회차 기록을 덮어썼어요)" : ""}. ${
          days === null ? "더 예전 기록이 없어요." : "최근 14일 안에 이전 기록이 없어서, 내일부터 이어지는 사건을 찾아 보여드려요."
        }`,
      });
    } else {
      const linkedCount = linked.filter((e) => e.previous).length;
      setNote({
        kind: "ok",
        message: `자동 저장했어요: ${label}${overwrite ? " (같은 날짜·회차 기록을 덮어썼어요)" : ""}. 이어지는 사건 ${linkedCount}개, 새로 등장 ${linked.length - linkedCount}개 (${
          days === null ? "저장된 모든 기록" : `최근 ${DEFAULT_DAYS}일`
        } 기준)`,
      });
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) return;

    resetResult();

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
    let metaLocal: ResultMeta | null = null;
    let finished = false;

    const handleMessage = (message: StreamMessage) => {
      switch (message.type) {
        case "meta":
          metaLocal = { edition: message.edition, date: message.date, articleCount: message.articleCount };
          setMeta(metaLocal);
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
      } else if (collected.length > 0 && !controller.signal.aborted) {
        // 요약이 정상으로 끝났을 때만: 이어지는 사건 찾기 + 자동 저장
        await linkAndSave(collected, metaLocal, DEFAULT_DAYS);
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
              resetResult();
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
        <ResultView events={events} meta={meta} finished={status.kind !== "summarizing"} flows={flows} />
      )}

      {status.kind === "done" && events.length > 0 && (
        <section
          className="mt-8 flex flex-col gap-6 border-t border-zinc-200 pt-6 dark:border-zinc-800"
          aria-label="저장과 흐름"
        >
          {linking && (
            <p className="text-sm" role="status">
              저장된 최근 기록에서 이어지는 사건을 찾는 중…
            </p>
          )}
          {manualSave && (
            <SavePanel
              key={`${meta?.date ?? ""}|${meta?.edition ?? ""}`}
              events={events}
              defaultDate={meta?.date ?? null}
              defaultEdition={meta?.edition ?? null}
              onSaved={() => setSavedCount((c) => c + 1)}
            />
          )}
          <HistoryBar
            refreshKey={savedCount}
            note={note}
            olderCount={olderCount}
            busy={linking}
            onSearchOlder={() => void linkAndSave(events, meta, null)}
            onCleared={() => {
              setSavedCount((c) => c + 1);
              setFlows({});
              setOlderCount(0);
              setNote({ kind: "info", message: "저장된 기록을 모두 지웠어요. 이 요약은 저장되어 있지 않아요." });
            }}
          />
        </section>
      )}
    </>
  );
}
