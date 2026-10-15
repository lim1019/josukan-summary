// Design Ref: §3.1, §7 — 공개 API가 짧은 시간에 마구 호출되지 않도록 입구에서 걸러 낸다
// Plan SC: CHECK.md P1-1 (보안 점검 1번) — 요청 모양 검사 + 속도 제한 (접속 암호는 쓰지 않기로 함)
//
// 이 파일은 `app/api/` 아래 모든 요청이 실제 API 코드에 닿기 전에 먼저 실행된다.
// 화면(페이지) 요청에는 적용되지 않는다.
import { NextResponse, type NextRequest } from "next/server";

/** 같은 접속자가 1분에 보낼 수 있는 요청 수 */
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60_000;

/**
 * 접속자별 최근 요청 시각. 서버 메모리에만 있어서,
 * Vercel처럼 서버가 여러 개로 나뉘면 완벽한 제한은 아니다(완화용).
 * 확실한 비용 상한은 Anthropic 콘솔의 월 사용 한도로 따로 건다.
 */
const recentRequests = new Map<string, number[]>();

function deny(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

function clientKey(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "unknown";
}

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const recent = (recentRequests.get(key) ?? []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  recent.push(now);
  recentRequests.set(key, recent);

  // 오래 안 온 접속자 기록은 정리해서 메모리가 계속 늘지 않게 한다
  if (recentRequests.size > 1000) {
    for (const [k, times] of recentRequests) {
      if (times.every((t) => now - t >= RATE_LIMIT_WINDOW_MS)) recentRequests.delete(k);
    }
  }
  return recent.length > RATE_LIMIT_MAX;
}

export function proxy(request: NextRequest) {
  // 1) 너무 자주 요청하면 막는다
  if (isRateLimited(clientKey(request))) {
    return deny(429, "요청이 너무 많아요. 잠시 후 다시 시도해 주세요.");
  }

  // 2) 다른 사이트의 화면에서 보낸 요청은 막는다
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) {
    return deny(403, "허용되지 않은 요청이에요.");
  }

  // 3) 글자 데이터(JSON)만 받는다
  if (request.method === "POST") {
    const contentType = request.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().startsWith("application/json")) {
      return deny(415, "JSON 형식의 요청만 받아요.");
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/api/:path*",
};
