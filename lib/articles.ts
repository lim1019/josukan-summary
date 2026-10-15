// Design Ref: §2.1 단계 5 — 기사 나누기. AI가 아니라 규칙으로 나눈다:
// 기사 본문은 PDF 원문 그대로 보관하고, AI에는 번호와 원문만 넘기기 위해서다 (프롬프트 인젝션 대비, 보안 점검 3번).
// 스크랩의 기사 머리줄(예: "한빛일보 2026. 10. 15.(목) 조간 · 3면 경제")을 기준으로 자른다.
import type { Article, PageText } from "./schema";

/** 기사 머리줄: 보도사 이름 + 날짜 + 조간/석간 (+ 면·섹션은 있으면 읽는다) */
const HEADER = /^(\S+)\s+(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})\.\s*\([^)]*\)\s*(조간|석간)(?:\s*·\s*(\d+)면\s*(.*))?$/;

/** 쪽 아래에 붙는 쪽수 표시 ("3쪽") */
const PAGE_FOOTER = /^\d+쪽$/;

export type SplitResult = {
  articles: Article[];
  /** 머리줄에서 읽은 회차와 날짜 (없으면 null) */
  edition: string | null;
  date: string | null;
};

function toLines(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !PAGE_FOOTER.test(line));
}

export function splitArticles(pages: PageText[]): SplitResult {
  const articles: Article[] = [];
  let edition: string | null = null;
  let date: string | null = null;

  type Draft = { outlet: string; page: number; endPage: number; lines: string[] };
  let current: Draft | null = null;

  const flush = () => {
    if (!current) return;
    const [title = "", ...body] = current.lines;
    articles.push({
      id: articles.length + 1,
      outlet: current.outlet,
      page: current.page,
      endPage: current.endPage,
      title,
      text: [title, ...body].join("\n"),
    });
    current = null;
  };

  for (const { page, text } of pages) {
    const lines = toLines(text);
    if (lines.length === 0) continue;

    // 한 쪽 안에 머리줄이 여러 번 나오면 그때마다 새 기사로 자른다
    for (const line of lines) {
      const header = HEADER.exec(line);
      if (header) {
        flush();
        const [, outlet, year, month, day, ed] = header;
        edition ??= ed ?? null;
        date ??= `${year}-${month!.padStart(2, "0")}-${day!.padStart(2, "0")}`;
        current = { outlet: outlet!, page, endPage: page, lines: [] };
      } else if (current) {
        current.lines.push(line);
        current.endPage = page;
      }
      // 첫 머리줄이 나오기 전의 글자(표지, 목차)는 기사가 아니므로 버린다
    }
  }
  flush();

  // 머리줄을 하나도 못 찾았으면 글자가 있는 쪽을 각각 기사 하나로 본다 (보도사는 알 수 없음)
  if (articles.length === 0) {
    for (const { page, text } of pages) {
      const lines = toLines(text);
      if (lines.length === 0) continue;
      articles.push({
        id: articles.length + 1,
        outlet: "보도사 미상",
        page,
        endPage: page,
        title: lines[0] ?? "",
        text: lines.join("\n"),
      });
    }
  }

  return { articles, edition, date };
}
