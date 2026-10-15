// Design Ref: §3.2, §4 — OpenAI API 호출. 서버에서만 실행된다 (API 키가 브라우저로 나가지 않게, 보안 점검 4번).
import "server-only";
import OpenAI from "openai";
import type { ModelCaller } from "./pipeline";

/** 사용할 모델. 비용을 낮추고 싶으면 이 한 줄만 바꾼다 (예: 더 저렴한 "gpt-6-luna"). */
export const MODEL = "gpt-6.1-sol";

/** .env의 OPENAI_API_KEY가 있는지만 본다 (값은 읽어 출력하지 않는다) */
export function hasApiKey(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

export function createModelCaller(): ModelCaller {
  const client = new OpenAI(); // OPENAI_API_KEY를 환경에서 읽는다

  return async ({ system, user, schema, maxTokens }) => {
    const response = await client.responses.create({
      model: MODEL,
      instructions: system,
      input: user,
      // 생각하는 데 쓰는 글자도 이 상한에 포함되므로 넉넉히 둔다
      max_output_tokens: maxTokens,
      // 기사 내용을 OpenAI 쪽에 저장하지 않게 한다 (PRD 7번: 서버·외부에 남기지 않는 방침)
      store: false,
      text: {
        format: {
          type: "json_schema",
          name: "result",
          strict: true,
          schema: schema as Record<string, unknown>,
        },
      },
    });

    if (response.status === "incomplete") {
      throw new Error("답이 너무 길어서 중간에 끊겼어요.");
    }
    for (const item of response.output) {
      if (item.type !== "message") continue;
      for (const part of item.content) {
        if (part.type === "refusal") {
          throw new Error("모델이 이 내용을 다루기를 거절했어요.");
        }
      }
    }

    const text = response.output_text;
    if (!text) {
      throw new Error("모델이 글자 답을 주지 않았어요.");
    }
    return JSON.parse(text) as unknown;
  };
}

/** 사용자에게 보여 줄 오류 문구. 서버 내부 내용이나 키는 담지 않는다. */
export function describeError(error: unknown): string {
  if (error instanceof OpenAI.AuthenticationError) {
    return "AI 연결 키가 올바르지 않아요. .env의 OPENAI_API_KEY를 확인해 주세요.";
  }
  if (error instanceof OpenAI.RateLimitError) {
    return "AI 사용 한도에 걸렸어요. 잠시 후 다시 시도하거나, 크레딧과 사용 한도를 확인해 주세요.";
  }
  if (error instanceof OpenAI.APIConnectionError) {
    return "AI 서비스에 연결하지 못했어요. 인터넷 연결을 확인하고 다시 시도해 주세요.";
  }
  if (error instanceof OpenAI.APIError) {
    return `AI 서비스에서 오류가 났어요 (${error.status}). 잠시 후 다시 시도해 주세요.`;
  }
  return "요약에 실패했어요. 다시 시도해 주세요.";
}
