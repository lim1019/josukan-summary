// Design Ref: §2.1 단계 10~11 — 자동 저장된 기록에서 "이어지는 사건"을 찾기 위한 준비와, 이어진 흐름(타임라인) 만들기.
// 브라우저에서만 실행된다 (저장소는 브라우저 안에 있다).
import { EDITIONS, type Edition } from "./limits";
import type { EventLink, HistoryEvent } from "./schema";
import { isValidDate, loadAllSaved, loadSaved } from "./storage";

/** 기본으로 살펴보는 기간 (일) */
export const DEFAULT_DAYS = 14;
/** AI에 한 번에 보내는 과거 사건 수 상한 (넘으면 오래된 것부터 뺀다) */
export const MAX_HISTORY_EVENTS = 400;

const EDITION_ORDER: Record<string, number> = { 조간: 0, 석간: 1 };

/** 날짜·회차를 한 줄로 비교할 수 있게 만든 값. 조간이 같은 날의 석간보다 먼저다. */
function stamp(date: string, edition: string): string {
  return `${date}:${EDITION_ORDER[edition] ?? 0}`;
}

function daysBetween(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

export type HistoryBuild = {
  events: HistoryEvent[];
  /** 번호(ref) → 어느 기록의 어느 사건인지 */
  refs: Map<number, { date: string; edition: Edition; eventId: number }>;
  /** 살펴보는 기간 밖에 있는, 더 예전 기록 수 (days가 null이면 0) */
  olderCount: number;
};

/**
 * 지금 요약보다 앞선 저장 기록의 사건을 모아 AI에 보낼 목록으로 만든다.
 * days가 숫자면 그 기간 안의 기록만, null이면 더 예전 것까지 모두 쓴다.
 */
export function buildHistory(date: string, edition: Edition, days: number | null): HistoryBuild {
  const now = stamp(date, edition);
  const earlier = loadAllSaved()
    .filter((r) => stamp(r.date, r.edition) < now)
    .sort((a, b) => stamp(a.date, a.edition).localeCompare(stamp(b.date, b.edition)));

  const inWindow = days === null ? earlier : earlier.filter((r) => daysBetween(r.date, date) <= days);
  const olderCount = earlier.length - inWindow.length;

  const events: HistoryEvent[] = [];
  const refs: HistoryBuild["refs"] = new Map();
  for (const record of inWindow) {
    for (const e of record.events) {
      const ref = events.length + 1;
      events.push({
        ref,
        label: `${record.date} ${record.edition}`,
        title: e.title.slice(0, 200),
        summary: e.summary.slice(0, 150),
      });
      refs.set(ref, { date: record.date, edition: record.edition, eventId: e.id });
    }
  }

  // 너무 많으면 오래된 것부터 뺀다 (번호는 새로 매긴다)
  if (events.length > MAX_HISTORY_EVENTS) {
    const drop = events.length - MAX_HISTORY_EVENTS;
    const kept = events.slice(drop).map((e, i) => ({ ...e, ref: i + 1 }));
    const keptRefs: HistoryBuild["refs"] = new Map();
    for (let i = 0; i < kept.length; i++) keptRefs.set(i + 1, refs.get(i + 1 + drop)!);
    return { events: kept, refs: keptRefs, olderCount };
  }
  return { events, refs, olderCount };
}

export type TimelineStep = { label: string; title: string };

/**
 * 한 사건의 이어진 흐름을 가까운 과거부터 거슬러 올라가며 모은다.
 * 각 기록에 저장돼 있는 "어디서 이어지는지" 연결을 따라가므로 AI를 다시 부르지 않는다.
 * 반환은 오래된 것부터 순서대로다.
 */
export function buildTimeline(link: EventLink | undefined): TimelineStep[] {
  const steps: TimelineStep[] = [];
  const seen = new Set<string>();
  let current = link;
  while (current && steps.length < 20) {
    const key = `${current.date}|${current.edition}|${current.eventId}`;
    if (seen.has(key)) break;
    seen.add(key);
    if (!isValidDate(current.date) || !(EDITIONS as readonly string[]).includes(current.edition)) break;
    const record = loadSaved(current.date, current.edition as Edition);
    const event = record?.events.find((e) => e.id === current!.eventId);
    if (!event) break;
    steps.unshift({ label: `${current.date} ${current.edition}`, title: event.title });
    current = event.previous;
  }
  return steps;
}
