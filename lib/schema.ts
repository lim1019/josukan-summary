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

/** 보도사가 사건을 다룬 태도. 기사에 나타난 표현·강조점만 근거로 하며, 보도사의 정치 성향 평가가 아니다. */
export const STANCES = ["긍정", "부정", "중립"] as const;
export type Stance = (typeof STANCES)[number];

/** 보도사 한 곳의 경향 한 줄. 끝에 붙는 출처(보도사·쪽수)를 함께 가진다. */
export type OutletView = {
  outlet: string;
  page: number;
  stance: Stance;
  text: string;
  /** text 안에서 태도(긍정·부정·중립) 판단의 근거가 된 기사 속 표현. 화면에서 굵게 보여준다. */
  evidence?: string[];
};

/** 사건 하나의 요약 결과 */
export type SummarizedEvent = {
  id: number;
  title: string;
  summary: string;
  /** 보도사마다 한 줄씩 (보도사가 한 곳뿐이면 비어 있다) */
  views: OutletView[];
  /** 이 사건을 다룬 곳 (보도사·쪽수) */
  coverage: { outlet: string; page: number }[];
  /** 규칙을 끝내 지키지 못한 부분이 있으면 사람이 읽을 수 있는 안내 */
  warnings: string[];
  /** 이전 기록에서 이어지는 사건이면 그 연결 (저장할 때 함께 남는다) */
  previous?: EventLink;
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

/** 2단계: 사건 하나의 제목·요약·보도사별 경향 */
export const SUMMARY_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    summary: { type: "string" },
    views: {
      type: "array",
      items: {
        type: "object",
        properties: {
          outlet: { type: "string" },
          page: { type: "integer" },
          stance: { type: "string", enum: ["긍정", "부정", "중립"] },
          text: { type: "string" },
          evidence: { type: "array", items: { type: "string" } },
        },
        required: ["outlet", "page", "stance", "text", "evidence"],
        additionalProperties: false,
      },
    },
  },
  required: ["title", "summary", "views"],
  additionalProperties: false,
} as const;

/** 비교할 때 AI에 보내는 사건 요약본 (기사 원문은 보내지 않는다) */
export type CompactEvent = {
  id: number;
  title: string;
  summary: string;
  outlets: string[];
};

/** 이전 기록의 어느 사건에서 이어지는지 (자동으로 찾아 저장한다) */
export type EventLink = {
  date: string;
  edition: string;
  eventId: number;
  /** 이어지는 직전 사건과 비교해 달라진 점 한 문장 */
  change: string;
};

/** 화면에 보여줄 한 사건의 흐름 */
export type FlowInfo = {
  /** true면 이전 기록에서 이어지는 사건, false면 새로 등장한 사건 */
  linked: boolean;
  /** 직전 사건과 비교해 달라진 점 (이어지는 사건일 때만) */
  change: string;
  /** 이어진 과거 사건들 (오래된 것부터) */
  steps: { label: string; title: string }[];
};

/** 흐름을 찾을 때 AI에 보내는 과거 사건 (요약본만, 기사 원문은 아님) */
export type HistoryEvent = {
  /** 이번 요청 안에서만 쓰는 번호 */
  ref: number;
  /** 예: "2026-10-14 석간" */
  label: string;
  title: string;
  summary: string;
};

/** 지금 사건 하나가 과거 사건 중 무엇에서 이어지는지 (없으면 previousRef가 null = 새로 등장) */
export type FlowMatch = {
  currentId: number;
  previousRef: number | null;
  change: string;
};

/** AI에게 요구하는 출력 모양 */
export const FLOW_SCHEMA = {
  type: "object",
  properties: {
    results: {
      type: "array",
      items: {
        type: "object",
        properties: {
          currentId: { type: "integer" },
          previousRef: { type: ["integer", "null"] },
          change: { type: "string" },
        },
        required: ["currentId", "previousRef", "change"],
        additionalProperties: false,
      },
    },
  },
  required: ["results"],
  additionalProperties: false,
} as const;

