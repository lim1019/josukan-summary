// Design Ref: §2.1 단계 11 — 요약이 끝나면 브라우저가 자동으로 부른다. 지금 사건 요약본과 최근 기록의 사건 요약본(기사 원문은 아님)을
// 받아, 지금 사건이 과거의 어느 사건에서 이어지는지 AI로 찾아 돌려준다. 받은 내용은 저장하지 않는다.
// 이 길도 proxy.ts(요청 모양 검사·속도 제한)를 먼저 통과해야 도착한다.
import { NextResponse } from "next/server";
import { createModelCaller, describeError, hasApiKey } from "@/lib/ai";
import { findFlow, MAX_EVENTS } from "@/lib/pipeline";
import type { CompactEvent, HistoryEvent } from "@/lib/schema";

export const maxDuration = 120;

/** 한 번에 받을 과거 사건 수 상한 (lib/flow.ts의 MAX_HISTORY_EVENTS와 같은 숫자) */
const MAX_HISTORY = 400;

function fail(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseCurrent(value: unknown): CompactEvent[] | null {
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

function parseHistory(value: unknown): HistoryEvent[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_HISTORY) return null;
  const events: HistoryEvent[] = [];
  for (const item of value) {
    if (
      !isRecord(item) ||
      typeof item.ref !== "number" ||
      !Number.isInteger(item.ref) ||
      typeof item.label !== "string" ||
      item.label.length > 40 ||
      typeof item.title !== "string" ||
      item.title.length > 300 ||
      typeof item.summary !== "string" ||
      item.summary.length > 400
    ) {
      return null;
    }
    events.push({ ref: item.ref, label: item.label, title: item.title, summary: item.summary });
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

  const current = parseCurrent(body.current);
  const history = parseHistory(body.history);
  if (!current || !history) {
    return fail(400, "이어지는 사건을 찾을 목록이 올바르지 않아요.");
  }

  if (!hasApiKey()) {
    return fail(503, "AI 연결 키가 아직 없어요. .env에 OPENAI_API_KEY를 넣고 서버를 다시 켜 주세요.");
  }

  try {
    const matches = await findFlow(current, history, createModelCaller());
    return NextResponse.json({ matches });
  } catch (error) {
    return fail(502, describeError(error));
  }
}
