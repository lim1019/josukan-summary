"use client";

// Design Ref: §1.3 [비교 불러오기] — 눌렀을 때만 열린다. 저장된 기록 중에서 회차와 날짜를 골라 지금 결과와 비교한다.
// 비교에는 사건 요약본만 서버로 보낸다 (기사 원문은 보내지 않음).
import { useState } from "react";
import { EDITIONS, type Edition } from "@/lib/limits";
import type { CompactEvent, ComparisonResult, SummarizedEvent } from "@/lib/schema";
import { listSaved, loadSaved } from "@/lib/storage";

type Props = {
  currentEvents: SummarizedEvent[];
  /** 저장이 일어날 때마다 바뀌는 숫자. 목록을 다시 읽게 한다 */
  refreshKey: number;
  comparison: ComparisonResult | null;
  onResult: (result: ComparisonResult | null) => void;
};

function toCompact(events: SummarizedEvent[]): CompactEvent[] {
  return events.map((e) => ({
    id: e.id,
    title: e.title,
    summary: e.summary,
    outlets: [...new Set(e.coverage.map((c) => c.outlet))],
  }));
}

export default function ComparePicker({ currentEvents, refreshKey, comparison, onResult }: Props) {
  const [open, setOpen] = useState(false);
  const [pick, setPick] = useState<{ edition: Edition; date: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 이 화면은 요약이 끝난 뒤 브라우저에서만 그려진다. 저장될 때마다(refreshKey가 바뀔 때) 다시 그려지며 목록을 새로 읽는다.
  void refreshKey;
  const records = listSaved();

  // 고른 값이 목록에 없으면(지워졌거나 아직 안 골랐으면) 가장 최근 기록을 쓴다
  const selected =
    pick && records.some((r) => r.edition === pick.edition && r.date === pick.date) ? pick : records[0] ?? null;
  const datesForEdition = selected ? records.filter((r) => r.edition === selected.edition) : [];

  async function handleCompare() {
    if (!selected) return;
    setError(null);

    const record = loadSaved(selected.date, selected.edition);
    if (!record || record.events.length === 0) {
      setError("저장된 기록을 읽지 못했어요. 다른 기록을 골라 주세요.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current: toCompact(currentEvents), previous: toCompact(record.events) }),
      });
      const data: unknown = await response.json().catch(() => null);

      if (!response.ok || typeof data !== "object" || data === null) {
        const message =
          typeof data === "object" && data !== null && "error" in data
            ? String((data as { error: unknown }).error)
            : "비교에 실패했어요. 다시 시도해 주세요";
        setError(message);
        return;
      }

      const { items, vanished } = data as Pick<ComparisonResult, "items" | "vanished">;
      onResult({ previousLabel: `${selected.date} ${selected.edition}`, items, vanished });
    } catch {
      setError("서버에 연결하지 못했어요. 다시 시도해 주세요");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          disabled={records.length === 0}
          aria-expanded={open}
          className="rounded-full border border-zinc-400 px-5 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40"
        >
          비교 불러오기
        </button>
        {comparison && (
          <button
            type="button"
            onClick={() => onResult(null)}
            className="rounded-full border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700"
          >
            비교 지우기
          </button>
        )}
        {records.length === 0 && (
          <span className="text-sm text-zinc-500">저장된 기록이 없어요. 먼저 저장해 두면 다음에 비교할 수 있어요.</span>
        )}
      </div>

      {open && selected && (
        <div className="flex flex-wrap items-center gap-4 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            {EDITIONS.map((name) => {
              const has = records.some((r) => r.edition === name);
              return (
                <label key={name} className={`flex items-center gap-2 text-sm ${has ? "" : "opacity-40"}`}>
                  <input
                    type="radio"
                    name="compare-edition"
                    value={name}
                    disabled={!has}
                    checked={selected.edition === name}
                    onChange={() => {
                      const first = records.find((r) => r.edition === name);
                      if (first) setPick({ edition: name, date: first.date });
                    }}
                  />
                  {name}
                </label>
              );
            })}
          </div>
          <select
            aria-label="불러올 날짜"
            value={selected.date}
            onChange={(e) => setPick({ edition: selected.edition, date: e.target.value })}
            className="rounded border border-zinc-300 bg-transparent px-2 py-1 text-sm dark:border-zinc-700"
          >
            {datesForEdition.map((r) => (
              <option key={r.date} value={r.date}>
                {r.date}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleCompare}
            disabled={loading}
            className="rounded-full bg-black px-5 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40 dark:bg-zinc-50 dark:text-black"
          >
            {loading ? "비교하는 중…" : "비교하기"}
          </button>
        </div>
      )}

      <div aria-live="polite">
        {error && (
          <p className="text-sm text-red-600 dark:text-red-400" role="alert">
            {error}
          </p>
        )}
        {comparison && !error && (
          <p className="text-sm text-zinc-600 dark:text-zinc-400" role="status">
            {comparison.previousLabel} 기록과 비교한 결과를 사건 카드에 표시했어요.
          </p>
        )}
      </div>
    </div>
  );
}
