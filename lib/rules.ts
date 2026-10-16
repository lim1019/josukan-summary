// Design Ref: §5 — AI가 지킬 규칙을 서버에서 한 번 더 검사한다 (지시문만 믿지 않기 위해).
import { STANCES, type OutletView, type Stance } from "./schema";

/** 요약 문장 수 상한 (PRD 5번) */
export const MAX_SUMMARY_SENTENCES = 5;

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

/** 따옴표·공백 차이는 무시하고 비교하기 위한 정리 */
function normalize(text: string): string {
  return text.replace(/[‘’“”'"\s]/g, "");
}

/**
 * 태도 판단의 근거 표현을 확인한다. 아래를 모두 만족하는 것만 남긴다.
 * - 한 줄(text) 안에 그대로 들어 있다 (그래야 화면에서 굵게 표시할 수 있다)
 * - 그 보도사의 기사 원문에 실제로 있다 (AI가 지어낸 인용을 걸러낸다)
 * - 너무 길지 않다 (줄 전체를 굵게 만드는 것을 막는다)
 */
export function verifyEvidence(
  evidence: string[],
  lineText: string,
  outlet: string,
  sources: { outlet: string; text: string }[],
): string[] {
  const source = normalize(sources.filter((s) => s.outlet === outlet).map((s) => s.text).join("\n"));
  const kept: string[] = [];
  for (const raw of evidence) {
    const phrase = raw.trim();
    if (phrase.length < 2 || phrase.length > 30) continue;
    if (!lineText.includes(phrase)) continue;
    if (source.length > 0 && !source.includes(normalize(phrase))) continue;
    if (!kept.includes(phrase)) kept.push(phrase);
    if (kept.length >= 2) break;
  }
  return kept;
}

export type CheckedSummary = {
  title: string;
  summary: string;
  views: OutletView[];
  /** 규칙을 어긴 이유 (비어 있으면 통과) */
  problems: string[];
};

/**
 * 사건 하나의 AI 답을 검사한다.
 * - 요약은 5문장 이내
 * - 기사에 나온 보도사마다 한 줄씩 (한 곳뿐이어도 그 한 곳, 빠지거나 중복되면 안 됨)
 * - 각 줄의 보도사·쪽수는 실제 기사에 있는 값이어야 하고, 한 줄에는 보도사 한 곳만 있어야 한다
 * - 태도(stance)는 긍정/부정/중립 중 하나
 * - 보도사가 한 곳뿐이어도 그 보도사의 경향 한 줄은 있어야 한다
 */
export function checkSummary(
  raw: {
    title: string;
    summary: string;
    views: { outlet: string; page: number; stance: string; text: string; evidence?: string[] }[];
  },
  coverage: { outlet: string; page: number }[],
  /** 근거 표현이 정말 기사에 있는지 확인할 때 쓰는 기사 원문 */
  sources: { outlet: string; text: string }[] = [],
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

  const views: OutletView[] = [];
  const seen = new Set<string>();
  for (const v of raw.views) {
    const text = stripLinks(v.text);
    if (!text || !outlets.has(v.outlet)) {
      problems.push("기사에 없는 보도사가 줄에 있었어요");
      continue;
    }
    if (seen.has(v.outlet)) {
      problems.push(`${v.outlet}이(가) 두 번 나왔어요`);
      continue;
    }
    if (!(STANCES as readonly string[]).includes(v.stance)) {
      problems.push(`${v.outlet}의 태도가 긍정/부정/중립이 아니었어요`);
      continue;
    }
    // 한 줄에는 보도사 한 곳만: 다른 보도사 이름이 섞이면 출처(보도사·쪽수)가 틀려진다
    for (const other of outlets) {
      if (other !== v.outlet && text.includes(other)) {
        problems.push("한 줄에 보도사 두 곳 이상이 섞였어요");
        break;
      }
    }
    let page = v.page;
    if (!validPairs.has(`${v.outlet}|${page}`)) {
      page = pagesByOutlet.get(v.outlet)![0]!;
      problems.push("줄의 쪽수를 실제 기사 쪽수로 고쳤어요");
    }
    seen.add(v.outlet);
    views.push({
      outlet: v.outlet,
      page,
      stance: v.stance as Stance,
      text,
      evidence: verifyEvidence(v.evidence ?? [], text, v.outlet, sources),
    });
  }

  const missing = [...outlets].filter((o) => !seen.has(o));
  if (missing.length > 0) {
    problems.push(`경향을 정리하지 못한 보도사: ${missing.join(", ")}`);
  }

  return { title, summary, views, problems };
}
