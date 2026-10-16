"use client";

// Design Ref: §1.3 [과거 흐름 비교] — 과거 기록과 이어지는 사건의 카드에만 나타나는 버튼.
// 누르면 달라진 점과 날짜별 흐름(과거 → 오늘)이 펼쳐진다. 다시 누르면 접힌다.
// AI가 만든 글은 모두 {글자} 방식으로만 그린다 (HTML로 해석하지 않음, 보안 점검 7번).
import { useState } from "react";
import type { FlowInfo } from "@/lib/schema";

export default function FlowCompare({ flow }: { flow: FlowInfo }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="rounded-full border border-violet-400 px-4 py-1.5 text-sm font-medium text-violet-800 dark:text-violet-300"
      >
        {open ? "과거 흐름 비교 닫기" : "과거 흐름 비교"}
      </button>

      {open && (
        <div className="mt-3 rounded bg-violet-50 px-3 py-3 text-sm dark:bg-violet-950/40">
          {flow.change && (
            <p>
              <span className="font-medium">달라진 점:</span> {flow.change}
            </p>
          )}
          {flow.steps.length > 0 && (
            <div className={flow.change ? "mt-2" : ""}>
              <p className="font-medium">흐름</p>
              <ol className="mt-1 space-y-0.5 text-zinc-700 dark:text-zinc-300">
                {flow.steps.map((step, i) => (
                  <li key={i}>
                    <span className="text-zinc-500">{step.label}</span> {step.title} <span aria-hidden="true">→</span>
                  </li>
                ))}
                <li className="font-medium">오늘 (이 요약)</li>
              </ol>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
