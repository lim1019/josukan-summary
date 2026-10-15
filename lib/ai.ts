// Design Ref: §3.2, §4 — Claude API 호출. 서버에서만 실행된다 (API 키가 브라우저로 나가지 않게, 보안 점검 4번).
import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { ModelCaller } from "./pipeline";

/** 사용할 모델. 비용을 낮추고 싶으면 이 한 줄만 바꾼다 (예: 더 저렴한 모델). */
export const MODEL = "claude-opus-5-5";

/** .env의 ANTHROPIC_API_KEY가 있는지만 본다 (값은 읽어 출력하지 않는다) */
export function hasApiKey(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export function createModelCaller(): ModelCaller {
  const client = new Anthropic();

  return async ({ system, user, schema, maxTokens }) => {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: maxTokens,
      system,
      // 이 모델은 생각하기가 항상 켜져 있다 (thinking 설정은 생략). 깊이는 effort로만 조절한다.
      output_config: { effort: "medium", format: { type: "json_schema", schema: schema as Record<string, unknown> } },
      messages: [{ role: "user", content: user }],
    });

    if (response.stop_reason === "refusal") {
      throw new Error("모델이 이 내용을 다루기를 거절했어요.");
    }
    if (response.stop_reason === "max_tokens") {
      throw new Error("답이 너무 길어서 중간에 끊겼어요.");
    }

    const block = response.content.find((b) => b.type === "text");
    if (!block || block.type !== "text") {
      throw new Error("모델이 글자 답을 주지 않았어요.");
    }
    return JSON.parse(block.text) as unknown;
  };
}

/** 사용자에게 보여 줄 오류 문구. 서버 내부 내용이나 키는 담지 않는다. */
export function describeError(error: unknown): string {
  if (error instanceof Anthropic.AuthenticationError) {
    return "AI 연결 키가 올바르지 않아요. .env의 ANTHROPIC_API_KEY를 확인해 주세요.";
  }
  if (error instanceof Anthropic.RateLimitError) {
    return "AI 사용 한도에 걸렸어요. 잠시 후 다시 시도해 주세요.";
  }
  if (error instanceof Anthropic.APIConnectionError) {
    return "AI 서비스에 연결하지 못했어요. 인터넷 연결을 확인하고 다시 시도해 주세요.";
  }
  if (error instanceof Anthropic.APIError) {
    return `AI 서비스에서 오류가 났어요 (${error.status}). 잠시 후 다시 시도해 주세요.`;
  }
  return "요약에 실패했어요. 다시 시도해 주세요.";
}
