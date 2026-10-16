"use client";

// Design Ref: §1.1 — 첫 화면에서 저장된 과거 요약을 바로 찾아본다. 날짜·회차를 누르면 그때 저장한 결과가 그대로 열린다.
// 서버나 AI를 부르지 않는다 (이 브라우저에 저장된 기록을 읽을 뿐이다).
import { useMemo, useSyncExternalStore } from "react";
import type { Edition } from "@/lib/limits";
import { listSaved, loadSaved, SAVED_CHANGE_EVENT } from "@/lib/storage";

function subscribe(onChange: () => void) {
  window.addEventListener(SAVED_CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange); // 다른 탭에서 바뀐 경우
  return () => {
    window.removeEventListener(SAVED_CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** 저장된 기록의 이름표를 한 줄 글자로 만든 값. 값이 같으면 다시 그리지 않는다. */
function getSnapshot(): string {
  return listSaved()
    .map((k) => `${k.date}:${k.edition}`)
    .join(",");
}

// 서버가 미리 그리는 화면에는 저장 기록이 없다 (기록은 브라우저 안에만 있다)
function getServerSnapshot(): string {
  return "";
}

export type PastKey = { date: string; edition: Edition };

export default function PastSummaries({
  active,
  onOpen,
}: {
  /** 지금 열려 있는 과거 요약 */
  active: PastKey | null;
  onOpen: (key: PastKey) => void;
}) {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const items = useMemo(() => {
    if (!snapshot) return [];
    return snapshot.split(",").flatMap((text) => {
      const [date, edition] = text.split(":") as [string, Edition];
      const record = loadSaved(date, edition);
      return record ? [{ date, edition, eventCount: record.events.length }] : [];
    });
  }, [snapshot]);

  if (items.length === 0) {
    return (
      <p className="max-w-xl text-sm text-zinc-600 dark:text-zinc-400">
        저장된 과거 요약이 아직 없어요. PDF를 요약하면 날짜·회차별로 자동 저장되고, 여기서 다시 찾아볼 수 있어요.
      </p>
    );
  }

  return (
    <section className="flex max-w-xl flex-col gap-2" aria-label="저장된 과거 요약">
      <h2 className="text-sm font-medium">날짜·회차를 누르면 그때 저장한 요약이 열려요</h2>
      <ul className="flex flex-wrap gap-2">
        {items.map((item) => {
          const isActive = active?.date === item.date && active.edition === item.edition;
          return (
            <li key={`${item.date}:${item.edition}`}>
              <button
                type="button"
                aria-pressed={isActive}
                onClick={() => onOpen({ date: item.date, edition: item.edition })}
                className={`rounded-full border px-3 py-1 text-sm ${
                  isActive
                    ? "border-black bg-black text-white dark:border-zinc-50 dark:bg-zinc-50 dark:text-black"
                    : "border-zinc-300 dark:border-zinc-700"
                }`}
              >
                {item.date} {item.edition} <span className={isActive ? "" : "text-zinc-500"}>· 사건 {item.eventCount}개</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
