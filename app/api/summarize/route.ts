// Design Ref: §2 단계 3~9 — 브라우저가 뽑은 글자만 받아 검사하고, 기사를 나눈 뒤 AI로 사건 묶기·요약을 하고,
// 끝난 사건부터 한 줄씩(NDJSON) 흘려보낸다. PDF 원본은 받지 않고, 받은 글자도 저장하지 않는다 (PRD 7번, DESIGN §2.2).
// 이 길은 proxy.ts(요청 모양 검사·속도 제한)를 먼저 통과해야 도착한다.
import { NextResponse } from "next/server";
import { createModelCaller, describeError, hasApiKey } from "@/lib/ai";
import { splitArticles } from "@/lib/articles";
import { LIMITS } from "@/lib/limits";
import { runPipeline } from "@/lib/pipeline";
import type { PageText, StreamMessage } from "@/lib/schema";

/** 긴 스크랩은 AI 처리에 시간이 걸린다 (초). 실제 허용 한도는 Vercel 요금제에 따라 달라서 배포 때 확인한다. */
export const maxDuration = 300;

function fail(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail(400, "요청 형식이 올바르지 않아요.");
  }

  if (!isRecord(body)) {
    return fail(400, "요청 형식이 올바르지 않아요.");
  }

  // 쪽별 글자: 모양과 상한을 서버에서도 한 번 더 확인한다 (화면 검사는 우회될 수 있음)
  const rawPages = body.pages;
  if (!Array.isArray(rawPages) || rawPages.length === 0) {
    return fail(400, "읽을 쪽이 없어요.");
  }
  if (rawPages.length > LIMITS.maxPages) {
    return fail(413, `쪽수가 너무 많아요 (최대 ${LIMITS.maxPages}쪽)`);
  }

  const pages: PageText[] = [];
  let totalChars = 0;
  for (const item of rawPages) {
    if (
      !isRecord(item) ||
      typeof item.page !== "number" ||
      !Number.isInteger(item.page) ||
      item.page < 1 ||
      typeof item.text !== "string"
    ) {
      return fail(400, "쪽 데이터 형식이 올바르지 않아요.");
    }
    totalChars += item.text.length;
    if (totalChars > LIMITS.maxTotalChars) {
      return fail(413, "글자 양이 너무 많아요. 더 짧은 스크랩을 올려 주세요.");
    }
    pages.push({ page: item.page, text: item.text });
  }

  if (totalChars === 0) {
    return fail(422, "글자를 읽을 수 없는 PDF예요. 글자가 들어 있는 스크랩을 올려 주세요");
  }

  // AI 연결 키 (값은 읽어 쓰지 않고 있는지만 확인한다)
  if (!hasApiKey()) {
    return fail(503, "AI 연결 키가 아직 없어요. .env에 ANTHROPIC_API_KEY를 넣고 서버를 다시 켜 주세요.");
  }

  const { articles, edition, date } = splitArticles(pages);
  if (articles.length === 0) {
    return fail(422, "기사를 찾지 못했어요. 스크랩 PDF가 맞는지 확인해 주세요.");
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (message: StreamMessage) => {
        controller.enqueue(encoder.encode(JSON.stringify(message) + "\n"));
      };

      try {
        emit({ type: "meta", edition, date, articleCount: articles.length });
        emit({ type: "progress", stage: "split", message: `기사 ${articles.length}건을 찾았어요` });
        await runPipeline(articles, createModelCaller(), emit);
      } catch (error) {
        emit({ type: "error", message: describeError(error) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
