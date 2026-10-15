// Design Ref: §2.3 — 데이터 모양. 화면(브라우저)과 서버가 함께 쓰므로 비밀 값이나 서버 전용 코드는 넣지 않는다.

/** 쪽별 글자 (lib/pdf.ts가 만든 모양과 같다) */
export type PageText = {
  page: number;
  text: string;
};

/** 스크랩에서 나눈 기사 하나. text는 PDF 원문 그대로이며 AI가 다시 쓰지 않는다. */
export type Article = {
  /** 서버가 붙인 번호 (1부터). AI는 이 번호로만 기사를 가리킨다. */
  id: number;
  outlet: string;
  /** 기사가 시작하는 쪽 */
  page: number;
  /** 기사가 끝나는 쪽 (한 쪽이면 page와 같다) */
  endPage: number;
  title: string;
  text: string;
};

/** 보도사별 차이 한 줄. 끝에 붙는 출처(보도사·쪽수)를 함께 가진다. */
export type Difference = {
  outlet: string;
  page: number;
  text: string;
};

/** 사건 하나의 요약 결과 */
export type SummarizedEvent = {
  id: number;
  title: string;
  summary: string;
  /** true면 보도사 간 뚜렷한 차이가 없다는 뜻 ("차이 없음") */
  noDifference: boolean;
  differences: Difference[];
  /** 이 사건을 다룬 곳 (보도사·쪽수) */
  coverage: { outlet: string; page: number }[];
  /** 규칙을 끝내 지키지 못한 부분이 있으면 사람이 읽을 수 있는 안내 */
  warnings: string[];
};

/** 서버가 브라우저로 한 줄씩 흘려보내는 소식 (NDJSON) */
export type StreamMessage =
  | { type: "meta"; edition: string | null; date: string | null; articleCount: number }
  | { type: "progress"; stage: "split" | "group" | "summarize"; message: string; done?: number; total?: number }
  | { type: "event"; event: SummarizedEvent }
  | { type: "done"; eventCount: number }
  | { type: "error"; message: string };

/** AI에게 요구하는 출력 모양 (JSON Schema). 1단계: 같은 사건끼리 기사 번호 묶기 */
export const GROUPING_SCHEMA = {
  type: "object",
  properties: {
    events: {
      type: "array",
      items: {
        type: "object",
        properties: {
          articleIds: { type: "array", items: { type: "integer" } },
        },
        required: ["articleIds"],
        additionalProperties: false,
      },
    },
  },
  required: ["events"],
  additionalProperties: false,
} as const;

/** 2단계: 사건 하나의 제목·요약·보도사별 차이 */
export const SUMMARY_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    summary: { type: "string" },
    noDifference: { type: "boolean" },
    differences: {
      type: "array",
      items: {
        type: "object",
        properties: {
          outlet: { type: "string" },
          page: { type: "integer" },
          text: { type: "string" },
        },
        required: ["outlet", "page", "text"],
        additionalProperties: false,
      },
    },
  },
  required: ["title", "summary", "noDifference", "differences"],
  additionalProperties: false,
} as const;
