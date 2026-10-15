// Design Ref: §1.3 — 사건 카드 하나: 제목, 5문장 이내 요약, 보도사별 차이(출처 포함), 다룬 곳.
// AI가 만든 글은 모두 {글자} 방식으로만 그린다 (HTML로 해석하지 않음, 보안 점검 7번).
import type { SummarizedEvent } from "@/lib/schema";

export default function EventCard({ event }: { event: SummarizedEvent }) {
  const outlets = new Set(event.coverage.map((c) => c.outlet));

  return (
    <article className="rounded-lg border border-zinc-200 p-5 dark:border-zinc-800">
      <h3 className="text-lg font-semibold leading-snug">{event.title || "(제목 없음)"}</h3>

      {event.summary && <p className="mt-3 leading-7">{event.summary}</p>}

      <div className="mt-4">
        <h4 className="text-sm font-medium text-zinc-500">보도사별 차이</h4>
        {outlets.size < 2 ? (
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">한 곳만 보도했어요.</p>
        ) : event.noDifference ? (
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">차이 없음</p>
        ) : (
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm leading-6">
            {event.differences.map((d, i) => (
              <li key={i}>
                {d.text}{" "}
                <span className="text-zinc-500">
                  ({d.outlet} {d.page}쪽)
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="mt-4 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
        <span>다룬 곳</span>
        {event.coverage.map((c, i) => (
          <span key={i} className="rounded-full border border-zinc-300 px-2 py-0.5 dark:border-zinc-700">
            {c.outlet} {c.page}쪽
          </span>
        ))}
      </p>

      {event.warnings.length > 0 && (
        <p className="mt-3 text-xs text-amber-700 dark:text-amber-400" role="note">
          참고: {event.warnings.join(" · ")}
        </p>
      )}
    </article>
  );
}
