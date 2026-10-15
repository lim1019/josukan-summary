// Design Ref: §2 단계 3~4 — 브라우저가 뽑은 글자만 받아 검사하고, 받았다는 확인을 돌려준다.
// PDF 원본은 받지 않고, 받은 글자도 저장하지 않는다 (PRD 7번, DESIGN §2.2).
// 이 길은 proxy.ts(접속 암호·속도 제한)를 먼저 통과해야 도착한다.
// 요약(AI 호출)은 PLAN 작업 5~8에서 이 자리에 이어 붙인다.
import { NextResponse } from "next/server";
import { LIMITS } from "@/lib/limits";

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

  // 쪽별 글자 (회차·날짜는 받지 않는다: 저장할 때 브라우저에서 고른다, DESIGN §1.3): 모양과 상한을 서버에서도 한 번 더 확인한다 (화면 검사는 우회될 수 있음)
  const pages = body.pages;
  if (!Array.isArray(pages) || pages.length === 0) {
    return fail(400, "읽을 쪽이 없어요.");
  }
  if (pages.length > LIMITS.maxPages) {
    return fail(413, `쪽수가 너무 많아요 (최대 ${LIMITS.maxPages}쪽)`);
  }

  let totalChars = 0;
  for (const item of pages) {
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
  }

  if (totalChars === 0) {
    return fail(422, "글자를 읽을 수 없는 PDF예요. 글자가 들어 있는 스크랩을 올려 주세요");
  }

  return NextResponse.json({
    ok: true,
    pageCount: pages.length,
    charCount: totalChars,
  });
}
