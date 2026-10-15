// Design Ref: §5 — AI가 지킬 규칙을 서버에서 한 번 더 검사한다 (지시문만 믿지 않기 위해).
import type { Difference } from "./schema";

/** 요약 문장 수 상한 (PRD 5번) */
export const MAX_SUMMARY_SENTENCES = 5;
/** 보도사별 차이 줄 수 (PRD 5번: 2~3줄) */
export const MIN_DIFFERENCES = 2;
export const MAX_DIFFERENCES = 3;

/**
 * 문장 수를 센다. 한글 글자나 따옴표·괄호 바로 뒤의 마침표·물음표·느낌표만 문장 끝으로 본다.
 * ("7.2%", "2026. 10. 15." 처럼 숫자 뒤의 점은 세지 않는다)
 */
export function countSentences(text: string): number {
  const trimmed = text.trim();
  if (trimmed.length === 0) return 0;
  const ends = trimmed.match(/[가-힣"'”’)\]][.!?](?=\s|$)/g);
  return Math.max(ends?.length ?? 0, 1);
}

/** 링크(http...)는 지운다. 기사 속 숨은 링크가 결과에 끼는 것을 막는다. */
export function stripLinks(text: string): string {
  return text.replace(/https?:\/\/\S+/g, "").replace(/\s{2,}/g, " ").trim();
}

export type CheckedSummary = {
  title: string;
  summary: string;
  noDifference: boolean;
  differences: Difference[];
  /** 규칙을 어긴 이유 (비어 있으면 통과) */
  problems: string[];
};

/**
 * 사건 하나의 AI 답을 검사한다.
 * - 요약은 5문장 이내
 * - 차이점은 보도사 2곳 이상일 때 2~3줄, 각 줄의 보도사·쪽수는 실제 기사에 있는 값이어야 한다
 * - 차이가 없으면 noDifference, 보도사가 한 곳뿐이면 차이 줄 없음
 */
export function checkSummary(
  raw: { title: string; summary: string; noDifference: boolean; differences: Difference[] },
  coverage: { outlet: string; page: number }[],
): CheckedSummary {
  const problems: string[] = [];
  const outlets = new Set(coverage.map((c) => c.outlet));
  const validPairs = new Set(coverage.map((c) => `${c.outlet}|${c.page}`));
  const pagesByOutlet = new Map<string, number[]>();
  for (const c of coverage) pagesByOutlet.set(c.outlet, [...(pagesByOutlet.get(c.outlet) ?? []), c.page]);

  const title = stripLinks(raw.title);
  const summary = stripLinks(raw.summary);

  if (countSentences(summary) > MAX_SUMMARY_SENTENCES) {
    problems.push(`요약이 ${MAX_SUMMARY_SENTENCES}문장을 넘었어요`);
  }

  // 차이 줄: 실제로 없는 보도사·쪽수는 버리고, 쪽수가 같은 보도사의 다른 쪽이면 그 보도사의 첫 쪽으로 맞춘다
  const differences: Difference[] = [];
  for (const d of raw.differences) {
    const text = stripLinks(d.text);
    if (!text || !outlets.has(d.outlet)) {
      problems.push("차이 줄에 기사에 없는 보도사가 있었어요");
      continue;
    }
    let page = d.page;
    if (!validPairs.has(`${d.outlet}|${page}`)) {
      page = pagesByOutlet.get(d.outlet)![0]!;
      problems.push("차이 줄의 쪽수를 실제 기사 쪽수로 고쳤어요");
    }
    differences.push({ outlet: d.outlet, page, text });
  }

  const outletCount = outlets.size;
  let noDifference = raw.noDifference;

  if (outletCount < 2) {
    // 한 곳만 다룬 사건: 비교할 상대가 없다
    return { title, summary, noDifference: false, differences: [], problems };
  }

  if (noDifference) {
    return { title, summary, noDifference: true, differences: [], problems };
  }

  if (differences.length < MIN_DIFFERENCES || differences.length > MAX_DIFFERENCES) {
    problems.push(`차이 줄이 ${differences.length}줄이에요 (${MIN_DIFFERENCES}~${MAX_DIFFERENCES}줄이어야 해요)`);
  }
  if (differences.length === 0) noDifference = true;

  return {
    title,
    summary,
    noDifference,
    differences: differences.slice(0, MAX_DIFFERENCES),
    problems,
  };
}
