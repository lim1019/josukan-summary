"use client";

// Design Ref: §1.3 — 자동 저장 결과 안내, "더 예전 기록까지 찾기", 저장된 기록 모두 지우기.
// 자동 저장은 브라우저에만 쌓이므로, 얼마나 쌓였는지 보여주고 언제든 지울 수 있게 한다.
import { useState } from "react";
import { clearAllSaved, listSaved } from "@/lib/storage";

export type HistoryNote = { kind: "ok" | "info" | "error"; message: string } | null;

type Props = {
  /** 저장·삭제가 일어날 때마다 바뀌는 숫자. 개수를 다시 읽게 한다 */
  refreshKey: number;
  note: HistoryNote;
  /** 기본 기간(14일)보다 더 예전에 있는 기록 수 */
  olderCount: number;
  busy: boolean;
  onSearchOlder: () => void;
  onCleared: () => void;
};

export default function HistoryBar({ refreshKey, note, olderCount, busy, onSearchOlder, onCleared }: Props) {
  const [confirmClear, setConfirmClear] = useState(false);

  // 요약이 끝난 뒤 브라우저에서만 그려지는 화면이다. refreshKey가 바뀌면 다시 그려지며 개수를 새로 읽는다.
  void refreshKey;
  const count = listSaved().length;

  const noteColor =
    note?.kind === "error"
      ? "text-red-600 dark:text-red-400"
      : note?.kind === "ok"
        ? "text-emerald-700 dark:text-emerald-400"
        : "text-zinc-600 dark:text-zinc-400";

  return (
    <div className="flex flex-col gap-3 text-sm">
      <div aria-live="polite">
        {note && (
          <p className={noteColor} role={note.kind === "error" ? "alert" : "status"}>
            {note.message}
          </p>
        )}
      </div>

      {olderCount > 0 && (
        <div>
          <button
            type="button"
            onClick={onSearchOlder}
            disabled={busy}
            className="rounded-full border border-zinc-400 px-4 py-1.5 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? "찾는 중…" : `더 예전 기록까지 찾기 (14일보다 앞선 기록 ${olderCount}개)`}
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 text-zinc-500">
        <span>이 브라우저에 저장된 요약 기록 {count}개 (서버에는 저장되지 않아요)</span>
        {count > 0 && !confirmClear && (
          <button
            type="button"
            onClick={() => setConfirmClear(true)}
            className="rounded-full border border-zinc-300 px-3 py-1 dark:border-zinc-700"
          >
            기록 모두 지우기
          </button>
        )}
        {confirmClear && (
          <span className="flex items-center gap-2" role="alert">
            <span className="text-zinc-700 dark:text-zinc-300">정말 모두 지울까요?</span>
            <button
              type="button"
              onClick={() => {
                clearAllSaved();
                setConfirmClear(false);
                onCleared();
              }}
              className="rounded-full border border-zinc-500 px-3 py-1"
            >
              지우기
            </button>
            <button
              type="button"
              onClick={() => setConfirmClear(false)}
              className="rounded-full border border-zinc-300 px-3 py-1 dark:border-zinc-700"
            >
              취소
            </button>
          </span>
        )}
      </div>
    </div>
  );
}
