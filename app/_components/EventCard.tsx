// Design Ref: §1.3 — 사건 카드 하나: 제목, 5문장 이내 요약, 보도사별 경향(긍정/부정/중립으로 묶음, 출처 포함), 다룬 곳.
// AI가 만든 글은 모두 {글자} 방식으로만 그린다 (HTML로 해석하지 않음, 보안 점검 7번).
import { STANCES, type EventComparison, type OutletView, type Stance, type SummarizedEvent } from "@/lib/schema";

/** 태도 이름표. 색에만 기대지 않도록 글자(긍정/부정/중립)와 기호를 함께 쓴다. */
const STANCE_STYLE: Record<Stance, { mark: string; className: string }> = {
  긍정: { mark: "＋", className: "text-emerald-700 dark:text-emerald-400" },
  부정: { mark: "－", className: "text-rose-700 dark:text-rose-400" },
  중립: { mark: "·", className: "text-zinc-600 dark:text-zinc-400" },
};

export default function EventCard({
  event,
  comparison,
}: {
  event: SummarizedEvent;
  /** [비교 불러오기]를 눌러 비교했을 때만 들어온다 */
  comparison?: EventComparison;
}) {
  const outlets = new Set(event.coverage.map((c) => c.outlet));

  const groups = STANCES.map((stance) => ({
    stance,
    views: event.views.filter((v: OutletView) => v.stance === stance),
  })).filter((g) => g.views.length > 0);

  return (
    <article className="rounded-lg border border-zinc-200 p-5 dark:border-zinc-800">
      {comparison && (
        <p className="mb-2 text-xs font-semibold">
          {comparison.previousId === null ? (
            <span className="rounded-full bg-sky-100 px-2 py-0.5 text-sky-800 dark:bg-sky-950 dark:text-sky-300">새로 등장</span>
          ) : (
            <span className="rounded-full bg-violet-100 px-2 py-0.5 text-violet-800 dark:bg-violet-950 dark:text-violet-300">이어지는 사건</span>
          )}
        </p>
      )}
      <h3 className="text-lg font-semibold leading-snug">{event.title || "(제목 없음)"}</h3>

      {event.summary && <p className="mt-3 leading-7">{event.summary}</p>}

      {comparison && comparison.previousId !== null && comparison.change && (
        <p className="mt-3 rounded bg-violet-50 px-3 py-2 text-sm dark:bg-violet-950/40">
          <span className="font-medium">달라진 점:</span> {comparison.change}
        </p>
      )}

      <div className="mt-4">
        <h4 className="text-sm font-medium text-zinc-500">보도사별 경향</h4>
        {outlets.size < 2 ? (
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">한 곳만 보도했어요.</p>
        ) : groups.length === 0 ? (
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">경향을 정리하지 못했어요.</p>
        ) : (
          <div className="mt-2 flex flex-col gap-3">
            {groups.map(({ stance, views }) => (
              <div key={stance}>
                <p className={`text-sm font-semibold ${STANCE_STYLE[stance].className}`}>
                  {STANCE_STYLE[stance].mark} {stance} ({views.length})
                </p>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-sm leading-6">
                  {views.map((v) => (
                    <li key={v.outlet}>
                      <span className="font-medium">{v.outlet}</span>: {v.text}{" "}
                      <span className="text-zinc-500">({v.page}쪽)</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
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
