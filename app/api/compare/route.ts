// Design Ref: §2.1 단계 11 — [비교 불러오기]를 눌렀을 때만 불린다. 지금 결과와 사용자가 고른 저장 기록의
// 사건 요약본(기사 원문은 아님)을 받아, 같은 사건이 이어지는지 AI로 판정해 돌려준다. 받은 내용은 저장하지 않는다.
// 이 길도 proxy.ts(요청 모양 검사·속도 제한)를 먼저 통과해야 도착한다.
import { NextResponse } from "next/server";
import { createModelCaller, describeError, hasApiKey } from "@/lib/ai";
import { compareEvents, MAX_EVENTS } from "@/lib/pipeline";
import type { CompactEvent } from "@/lib/schema";

export const maxDuration = 120;

function fail(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** 요청 속 사건 목록의 모양과 크기를 서버에서 확인한다 */
function parseEvents(value: unknown): CompactEvent[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_EVENTS) return null;
  const events: CompactEvent[] = [];
  for (const item of value) {
    if (
      !isRecord(item) ||
      typeof item.id !== "number" ||
      !Number.isInteger(item.id) ||
      typeof item.title !== "string" ||
      item.title.length > 300 ||
      typeof item.summary !== "string" ||
      item.summary.length > 3000 ||
      !Array.isArray(item.outlets) ||
      item.outlets.length > 40 ||
      !item.outlets.every((o) => typeof o === "string" && o.length <= 60)
    ) {
      return null;
    }
    events.push({ id: item.id, title: item.title, summary: item.summary, outlets: item.outlets as string[] });
  }
  return events;
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

  const current = parseEvents(body.current);
  const previous = parseEvents(body.previous);
  if (!current || !previous) {
    return fail(400, `비교할 사건 목록이 올바르지 않아요 (각각 1~${MAX_EVENTS}개).`);
  }

  if (!hasApiKey()) {
    return fail(503, "AI 연결 키가 아직 없어요. .env에 OPENAI_API_KEY를 넣고 서버를 다시 켜 주세요.");
  }

  try {
    const { items, vanishedIds } = await compareEvents(current, previous, createModelCaller());
    const titleById = new Map(previous.map((e) => [e.id, e.title]));
    return NextResponse.json({
      items,
      vanished: vanishedIds.map((id) => ({ id, title: titleById.get(id) ?? "" })),
    });
  } catch (error) {
    return fail(502, describeError(error));
  }
}
