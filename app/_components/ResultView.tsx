// Design Ref: §1.3 — 결과 머리(사건 수·기사 수)와 사건 카드 목록. 다룬 보도사가 많은 사건이 위로 온다.
import type { Digest, FlowInfo, SummarizedEvent } from "@/lib/schema";
import EventCard from "./EventCard";
import FlowSection, { type FlowStatus } from "./FlowSection";

export type ResultMeta = {
  edition: string | null;
  date: string | null;
  articleCount: number;
};

/** 사건의 보도사별 태도를 "긍정 2·부정 3·중립 1" 모양으로 센다 (보도사가 한 곳뿐이면 비운다) */
function stanceCounts(event: SummarizedEvent): string {
  if (event.views.length === 0) return "";
  return (["긍정", "부정", "중립"] as const)
    .map((stance) => ({ stance, n: event.views.filter((v) => v.stance === stance).length }))
    .filter((x) => x.n > 0)
    .map((x) => `${x.stance} ${x.n}`)
    .join("·");
}

export default function ResultView({
  events,
  meta,
  finished,
  flows,
  flowStatus,
  digest,
}: {
  events: SummarizedEvent[];
  meta: ResultMeta | null;
  finished: boolean;
  /** 사건 번호 → 흐름. 아직 찾지 못했으면 비어 있다 */
  flows: Record<number, FlowInfo>;
  /** 이어지는 사건 찾기의 진행 상태 */
  flowStatus: FlowStatus;
  /** 오늘의 내용 요약. 아직 만드는 중이거나 만들지 못했으면 null */
  digest: Digest | null;
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
      {digest && (
        <div className="mt-4 rounded-lg bg-zinc-50 p-5 dark:bg-zinc-900" aria-label="오늘의 내용 요약">
          <h3 className="text-base font-semibold">오늘의 내용 요약</h3>
          <p className="mt-2 leading-7">{digest.overview}</p>
          {digest.highlights.length > 0 && (
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm leading-6">
              {digest.highlights.map((h) => {
                const event = events.find((e) => e.id === h.eventId);
                const counts = event ? stanceCounts(event) : "";
                return (
                  <li key={h.eventId}>
                    {h.text}
                    {counts && <span className="text-zinc-500"> ({counts})</span>}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {finished && <FlowSection events={events} flows={flows} status={flowStatus} />}

      <h3 className="mt-8 text-base font-semibold">사건별 요약과 보도사별 반응</h3>
      <div className="mt-3 flex flex-col gap-4">
        {sorted.map((event) => (
          <EventCard
            key={event.id}
            event={event}
            flow={flows[event.id]}
          />
        ))}
      </div>

    </section>
  );
}
