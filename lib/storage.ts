// Design Ref: §2.2, §4 — 요약 결과를 각자의 브라우저(localStorage)에만 저장한다. 서버·DB에는 보내지 않는다.
// 브라우저에서만 실행된다. 저장소를 못 쓰는 환경(시크릿 창 등)에서도 화면이 멈추지 않도록 모든 읽기·쓰기를 감싼다.
import { EDITIONS, type Edition } from "./limits";
import { STANCES, type SummarizedEvent } from "./schema";

const PREFIX = "summary:";

export type SavedRecord = {
  version: 1;
  date: string;
  edition: Edition;
  savedAt: string;
  events: SummarizedEvent[];
};

export type SavedKey = { date: string; edition: Edition };

export function storageKey(date: string, edition: Edition): string {
  return `${PREFIX}${date}:${edition}`;
}

export function isValidDate(date: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(date);
}

/** 저장소에서 읽은 값은 믿지 않고 모양을 확인한다 (보안 점검 7번) */
function isEventLink(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return false;
  const l = value as Record<string, unknown>;
  return (
    typeof l.date === "string" &&
    isValidDate(l.date) &&
    typeof l.edition === "string" &&
    typeof l.eventId === "number" &&
    typeof l.change === "string"
  );
}

function isSummarizedEvent(value: unknown): value is SummarizedEvent {
  if (typeof value !== "object" || value === null) return false;
  const e = value as Record<string, unknown>;
  return (
    typeof e.id === "number" &&
    typeof e.title === "string" &&
    typeof e.summary === "string" &&
    Array.isArray(e.warnings) &&
    (e.previous === undefined || isEventLink(e.previous)) &&
    Array.isArray(e.coverage) &&
    e.coverage.every(
      (c) =>
        typeof c === "object" &&
        c !== null &&
        typeof (c as { outlet?: unknown }).outlet === "string" &&
        typeof (c as { page?: unknown }).page === "number",
    ) &&
    Array.isArray(e.views) &&
    e.views.every((v) => {
      if (typeof v !== "object" || v === null) return false;
      const x = v as Record<string, unknown>;
      return (
        typeof x.outlet === "string" &&
        typeof x.page === "number" &&
        typeof x.text === "string" &&
        typeof x.stance === "string" &&
        (STANCES as readonly string[]).includes(x.stance) &&
        (x.evidence === undefined || (Array.isArray(x.evidence) && x.evidence.every((p) => typeof p === "string")))
      );
    })
  );
}

function isSavedRecord(value: unknown): value is SavedRecord {
  if (typeof value !== "object" || value === null) return false;
  const r = value as Record<string, unknown>;
  return (
    r.version === 1 &&
    typeof r.date === "string" &&
    isValidDate(r.date) &&
    typeof r.edition === "string" &&
    (EDITIONS as readonly string[]).includes(r.edition) &&
    typeof r.savedAt === "string" &&
    Array.isArray(r.events) &&
    r.events.every(isSummarizedEvent)
  );
}

/** 저장된 기록의 이름표(날짜·회차) 목록. 최근 날짜가 먼저 온다. */
export function listSaved(): SavedKey[] {
  const found: SavedKey[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(PREFIX)) continue;
      const [date, edition] = key.slice(PREFIX.length).split(":");
      if (date && edition && isValidDate(date) && (EDITIONS as readonly string[]).includes(edition)) {
        found.push({ date, edition: edition as Edition });
      }
    }
  } catch {
    return [];
  }
  return found.sort((a, b) => (a.date === b.date ? a.edition.localeCompare(b.edition) : b.date.localeCompare(a.date)));
}

export function hasSaved(date: string, edition: Edition): boolean {
  try {
    return localStorage.getItem(storageKey(date, edition)) !== null;
  } catch {
    return false;
  }
}

export function loadSaved(date: string, edition: Edition): SavedRecord | null {
  try {
    const raw = localStorage.getItem(storageKey(date, edition));
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    return isSavedRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveRecord(date: string, edition: Edition, events: SummarizedEvent[]): { ok: true } | { ok: false } {
  const record: SavedRecord = { version: 1, date, edition, savedAt: new Date().toISOString(), events };
  try {
    localStorage.setItem(storageKey(date, edition), JSON.stringify(record));
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

/** 저장된 기록을 모두 읽는다 (모양이 깨진 것은 무시) */
export function loadAllSaved(): SavedRecord[] {
  return listSaved()
    .map((k) => loadSaved(k.date, k.edition))
    .filter((r): r is SavedRecord => r !== null);
}

/** 저장된 요약 기록을 모두 지운다. 이 앱이 만든 "summary:" 기록만 지운다. */
export function clearAllSaved(): number {
  let removed = 0;
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(PREFIX)) keys.push(key);
    }
    for (const key of keys) {
      localStorage.removeItem(key);
      removed++;
    }
  } catch {
    return removed;
  }
  return removed;
}
