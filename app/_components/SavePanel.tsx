"use client";

// Design Ref: §1.3 [저장] — 요약 결과를 보고 마음에 들면 조간/석간과 날짜를 골라 이 브라우저에만 저장한다.
// 같은 날짜·회차가 이미 있으면 덮어쓸지 묻는다. 저장하지 않으면 아무것도 남지 않는다 (서버·DB 저장 없음).
import { useState } from "react";
import { EDITIONS, type Edition } from "@/lib/limits";
import type { SummarizedEvent } from "@/lib/schema";
import { hasSaved, isValidDate, saveRecord } from "@/lib/storage";

type Props = {
  events: SummarizedEvent[];
  /** PDF 머리줄에서 읽은 날짜·회차. 있으면 기본값으로 쓴다 (없으면 오늘, 조간) */
  defaultDate: string | null;
  defaultEdition: string | null;
  onSaved: () => void;
};

type Notice = { kind: "ok" | "error"; message: string } | null;

export default function SavePanel({ events, defaultDate, defaultEdition, onSaved }: Props) {
  const [edition, setEdition] = useState<Edition>(
    (EDITIONS as readonly string[]).includes(defaultEdition ?? "") ? (defaultEdition as Edition) : "조간",
  );
  // 이 화면은 요약이 끝난 뒤 브라우저에서만 그려지므로, 여기서 오늘 날짜를 읽어도 서버 화면과 어긋나지 않는다
  const [date, setDate] = useState(() => defaultDate ?? new Date().toLocaleDateString("sv-SE"));
  const [confirmOverwrite, setConfirmOverwrite] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  function doSave() {
    const result = saveRecord(date, edition, events);
    setConfirmOverwrite(false);
    if (result.ok) {
      setNotice({ kind: "ok", message: `저장했어요: ${date} ${edition}` });
      onSaved();
    } else {
      setNotice({
        kind: "error",
        message: "저장하지 못했어요. 이 결과는 나중에 비교 불러오기에서 고를 수 없어요 (브라우저 저장 공간을 확인해 주세요).",
      });
    }
  }

  function handleSave() {
    setNotice(null);
    if (!isValidDate(date)) {
      setNotice({ kind: "error", message: "날짜를 골라 주세요" });
      return;
    }
    if (hasSaved(date, edition)) {
      setConfirmOverwrite(true);
      return;
    }
    doSave();
  }

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-sm font-medium">저장</h2>
      <div className="flex flex-wrap items-center gap-4">
        {EDITIONS.map((name) => (
          <label key={name} className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="save-edition"
              value={name}
              checked={edition === name}
              onChange={() => {
                setEdition(name);
                setConfirmOverwrite(false);
                setNotice(null);
              }}
            />
            {name}
          </label>
        ))}
        <input
          type="date"
          aria-label="저장할 날짜"
          value={date}
          onChange={(e) => {
            setDate(e.target.value);
            setConfirmOverwrite(false);
            setNotice(null);
          }}
          className="rounded border border-zinc-300 bg-transparent px-2 py-1 text-sm dark:border-zinc-700"
        />
        <button
          type="button"
          onClick={handleSave}
          disabled={events.length === 0}
          className="rounded-full bg-black px-5 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40 dark:bg-zinc-50 dark:text-black"
        >
          저장
        </button>
      </div>

      {confirmOverwrite && (
        <div className="flex flex-wrap items-center gap-3 text-sm" role="alert">
          <span>이미 저장된 요약이 있어요. 덮어쓸까요?</span>
          <button type="button" onClick={doSave} className="rounded-full border border-zinc-400 px-4 py-1">
            덮어쓰기
          </button>
          <button
            type="button"
            onClick={() => setConfirmOverwrite(false)}
            className="rounded-full border border-zinc-300 px-4 py-1 dark:border-zinc-700"
          >
            취소
          </button>
        </div>
      )}

      <div aria-live="polite">
        {notice && (
          <p
            className={`text-sm ${notice.kind === "ok" ? "text-emerald-700 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}
            role={notice.kind === "error" ? "alert" : "status"}
          >
            {notice.message}
          </p>
        )}
      </div>
    </div>
  );
}
