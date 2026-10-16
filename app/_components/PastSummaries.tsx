"use client";

// Design Ref: §1.1 — "2. 과거 자료 찾기": 회차(조간/석간)와 년·월·일을 따로 고르고 [열기]를 누르면 그때 저장한 요약이 열린다.
// 고를 수 있는 년·월·일은 그 회차로 저장된 날짜뿐이다 (년을 고르면 그 해에 저장된 월만, 월을 고르면 그 달에 저장된 일만 나온다). 서버나 AI를 부르지 않는다 (이 브라우저에 저장된 기록을 읽을 뿐이다).
import { useMemo, useState, useSyncExternalStore } from "react";
import { EDITIONS, type Edition } from "@/lib/limits";
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

type Item = { date: string; edition: Edition };

export default function PastSummaries({
  active,
  onOpen,
}: {
  /** 지금 열려 있는 과거 요약 */
  active: PastKey | null;
  onOpen: (key: PastKey) => void;
}) {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [pick, setPick] = useState<PastKey | null>(null);

  const items = useMemo<Item[]>(() => {
    if (!snapshot) return [];
    return snapshot.split(",").flatMap((text) => {
      const [date, edition] = text.split(":") as [string, Edition];
      const record = loadSaved(date, edition);
      return record ? [{ date, edition }] : [];
    });
  }, [snapshot]);

  if (items.length === 0) {
    return (
      <p className="max-w-xl text-sm text-zinc-600 dark:text-zinc-400">
        저장된 과거 요약이 아직 없어요. PDF를 요약하면 날짜·회차별로 자동 저장되고, 여기서 회차와 날짜를 골라 다시 찾아볼 수 있어요.
      </p>
    );
  }

  // 고른 값이 목록에 있으면 그것을, 없으면 열려 있는 요약을, 그것도 없으면 가장 최근 기록을 쓴다
  const exists = (k: PastKey | null) => k !== null && items.some((i) => i.edition === k.edition && i.date === k.date);
  const selected: PastKey = exists(pick) ? pick! : exists(active) ? active! : { date: items[0]!.date, edition: items[0]!.edition };
  const datesForEdition = items.filter((i) => i.edition === selected.edition); // 최근 날짜가 먼저
  const [year = "", month = "", day = ""] = selected.date.split("-");

  // 년 → 월 → 일 순으로 좁혀 가며 그 회차로 저장된 값만 보여준다
  const years = [...new Set(datesForEdition.map((i) => i.date.slice(0, 4)))];
  const months = [...new Set(datesForEdition.filter((i) => i.date.startsWith(`${year}-`)).map((i) => i.date.slice(5, 7)))];
  const days = datesForEdition.filter((i) => i.date.startsWith(`${year}-${month}-`));

  /** 년이나 월을 바꾸면, 그 안에서 가장 최근에 저장된 날짜로 맞춘다 */
  const pickLatestIn = (prefix: string) => {
    const found = datesForEdition.find((i) => i.date.startsWith(prefix));
    if (found) setPick({ edition: selected.edition, date: found.date });
  };

  return (
    <section className="flex max-w-xl flex-col gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800" aria-label="과거 자료 찾기">
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium">회차</legend>
        <div className="flex items-center gap-4">
          {EDITIONS.map((name) => {
            const has = items.some((i) => i.edition === name);
            return (
              <label key={name} className={`flex items-center gap-2 text-sm ${has ? "" : "opacity-40"}`}>
                <input
                  type="radio"
                  name="past-edition"
                  value={name}
                  disabled={!has}
                  checked={selected.edition === name}
                  onChange={() => {
                    const first = items.find((i) => i.edition === name);
                    if (first) setPick({ edition: name, date: first.date });
                  }}
                />
                {name}
                {!has && <span className="text-xs text-zinc-500">(저장된 것 없음)</span>}
              </label>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium">날짜</legend>
        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="년"
            value={year}
            onChange={(e) => pickLatestIn(`${e.target.value}-`)}
            className="rounded border border-zinc-300 bg-transparent px-2 py-1.5 text-sm dark:border-zinc-700"
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}년
              </option>
            ))}
          </select>
          <select
            aria-label="월"
            value={month}
            onChange={(e) => pickLatestIn(`${year}-${e.target.value}-`)}
            className="rounded border border-zinc-300 bg-transparent px-2 py-1.5 text-sm dark:border-zinc-700"
          >
            {months.map((m) => (
              <option key={m} value={m}>
                {Number(m)}월
              </option>
            ))}
          </select>
          <select
            aria-label="일"
            value={day}
            onChange={(e) => setPick({ edition: selected.edition, date: `${year}-${month}-${e.target.value}` })}
            className="rounded border border-zinc-300 bg-transparent px-2 py-1.5 text-sm dark:border-zinc-700"
          >
            {days.map((i) => (
              <option key={i.date} value={i.date.slice(8, 10)}>
                {Number(i.date.slice(8, 10))}일
              </option>
            ))}
          </select>
        </div>
        <p className="text-xs text-zinc-500">이 회차로 저장된 년·월·일만 나와요.</p>
      </fieldset>

      <div>
        <button
          type="button"
          onClick={() => onOpen(selected)}
          className="rounded-full bg-black px-5 py-2 text-sm font-medium text-white dark:bg-zinc-50 dark:text-black"
        >
          열기
        </button>
      </div>
    </section>
  );
}
