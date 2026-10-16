// Design Ref: §1.3 — 결과 머리(날짜·회차·사건 수·기사 수)와 사건 카드 목록. 다룬 보도사가 많은 사건이 위로 온다.
// 사건마다 객관적인 사실 요약과 보도사별 반응을 보여주고, 이어지는 사건은 카드 안의 [과거 흐름 비교]로 과거 흐름을 볼 수 있다.
import type { FlowInfo, SummarizedEvent } from "@/lib/schema";
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
  flows,
  flowLastLabel,
}: {
  events: SummarizedEvent[];
  meta: ResultMeta | null;
  finished: boolean;
  /** 사건 번호 → 흐름. 아직 찾지 못했거나 비교할 기록이 없으면 비어 있다 */
  flows: Record<number, FlowInfo>;
  /** 흐름 마지막 줄 이름 (기본: "오늘 (이 요약)") */
  flowLastLabel?: string;
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
          <EventCard key={event.id} event={event} flow={flows[event.id]} flowLastLabel={flowLastLabel} />
        ))}
      </div>
    </section>
  );
}
