// Design Ref: §1.3 — "흐름 비교": 저장된 최근 기록에서 이어지는 사건들을 한 구역에 모아 보여준다.
// 이어지는 사건마다 달라진 점과 날짜별 흐름(과거 → 오늘)을 보여주고, 새로 등장한 사건은 제목만 나열한다.
// AI가 만든 글은 모두 {글자} 방식으로만 그린다 (HTML로 해석하지 않음, 보안 점검 7번).
import type { FlowInfo, SummarizedEvent } from "@/lib/schema";

/** pending: 아직 시작 전 / searching: 찾는 중 / empty: 비교할 이전 기록이 없음 / error: 찾지 못함 / ready: 결과 있음 */
export type FlowStatus = "pending" | "searching" | "empty" | "error" | "ready";

export default function FlowSection({
  events,
  flows,
  status,
}: {
  events: SummarizedEvent[];
  flows: Record<number, FlowInfo>;
  status: FlowStatus;
}) {
  if (status === "pending") return null;

  const outletCount = (e: SummarizedEvent) => new Set(e.coverage.map((c) => c.outlet)).size;
  const sorted = [...events].sort((a, b) => outletCount(b) - outletCount(a) || a.id - b.id);
  const linked = sorted.filter((e) => flows[e.id]?.linked);
  const fresh = sorted.filter((e) => flows[e.id] && !flows[e.id]!.linked);

  return (
    <section className="mt-6 rounded-lg border border-violet-200 p-5 dark:border-violet-900" aria-label="흐름 비교">
      <h3 className="text-base font-semibold">
        흐름 비교
        {status === "ready" && (
          <span className="ml-2 text-sm font-normal text-zinc-500">
            이어지는 사건 {linked.length}개 · 새로 등장 {fresh.length}개
          </span>
        )}
      </h3>

      {status === "searching" && (
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400" role="status">
          저장된 최근 기록에서 이어지는 사건을 찾는 중…
        </p>
      )}
      {status === "empty" && (
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          비교할 이전 기록이 아직 없어요. 오늘 요약이 저장되었으니, 다음 요약부터 이어지는 사건을 찾아 보여드려요.
        </p>
      )}
      {status === "error" && (
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">이어지는 사건을 찾지 못했어요. 아래 안내를 확인해 주세요.</p>
      )}

      {status === "ready" && (
        <>
          {linked.length === 0 ? (
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">이어지는 사건이 없어요. 오늘 사건은 모두 새로 등장했어요.</p>
          ) : (
            <ul className="mt-3 flex flex-col gap-4">
              {linked.map((event) => {
                const flow = flows[event.id]!;
                return (
                  <li key={event.id} className="text-sm">
                    <p className="font-medium">{event.title || "(제목 없음)"}</p>
                    {flow.change && (
                      <p className="mt-1">
                        <span className="font-medium">달라진 점:</span> {flow.change}
                      </p>
                    )}
                    {flow.steps.length > 0 && (
                      <ol className="mt-1 space-y-0.5 text-zinc-700 dark:text-zinc-300">
                        {flow.steps.map((step, i) => (
                          <li key={i}>
                            <span className="text-zinc-500">{step.label}</span> {step.title} <span aria-hidden="true">→</span>
                          </li>
                        ))}
                        <li className="font-medium">오늘 (이 요약)</li>
                      </ol>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {fresh.length > 0 && (
            <div className="mt-4 text-sm">
              <p className="font-medium text-zinc-600 dark:text-zinc-400">새로 등장한 사건</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5">
                {fresh.map((event) => (
                  <li key={event.id}>{event.title || "(제목 없음)"}</li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  );
}
