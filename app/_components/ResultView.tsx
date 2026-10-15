// Design Ref: §1.3 — 결과 머리(사건 수·기사 수)와 사건 카드 목록. 다룬 보도사가 많은 사건이 위로 온다.
import type { ComparisonResult, SummarizedEvent } from "@/lib/schema";
import EventCard from "./EventCard";

export type ResultMeta = {
  edition: string | null;
  date: string | null;
  articleCount: number;
};

export default function ResultView({
  events,
  meta,
  finished,
  comparison,
}: {
  events: SummarizedEvent[];
  meta: ResultMeta | null;
  finished: boolean;
  comparison: ComparisonResult | null;
}) {
  const outletCount = (e: SummarizedEvent) => new Set(e.coverage.map((c) => c.outlet)).size;
  const sorted = [...events].sort((a, b) => outletCount(b) - outletCount(a) || a.id - b.id);

  const label = [meta?.date, meta?.edition].filter(Boolean).join(" ");

  return (
    <section className="mt-10" aria-label="요약 결과">
      <h2 className="text-xl font-semibold">
        {label ? `${label} · ` : ""}사건 {events.length}개
        {meta ? ` · 기사 ${meta.articleCount}건` : ""}
        {!finished && <span className="ml-2 text-sm font-normal text-zinc-500">(만드는 중…)</span>}
      </h2>
      <div className="mt-4 flex flex-col gap-4">
        {sorted.map((event) => (
          <EventCard
            key={event.id}
            event={event}
            comparison={comparison?.items.find((c) => c.currentId === event.id)}
          />
        ))}
      </div>

      {comparison && comparison.vanished.length > 0 && (
        <div className="mt-6 rounded-lg border border-dashed border-zinc-300 p-4 dark:border-zinc-700">
          <h3 className="text-sm font-semibold">{comparison.previousLabel} 기록에만 있는 사건</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
            {comparison.vanished.map((v) => (
              <li key={v.id}>{v.title || "(제목 없음)"}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
