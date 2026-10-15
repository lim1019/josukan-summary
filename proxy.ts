// Design Ref: §3.1, §7 — 로그인 없는 공개 API가 AI 비용 남용에 쓰이지 않도록 입구에서 막는다
// Plan SC: CHECK.md P1-1 (보안 점검 1번) — 접속 암호 + 요청 모양 검사 + 속도 제한
//
// 이 파일은 `app/api/` 아래 모든 요청이 실제 API 코드에 닿기 전에 먼저 실행된다.
// 화면(페이지) 요청에는 적용되지 않는다.
import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";

/** 접속 암호는 `.env`의 APP_ACCESS_CODE에서 읽는다 (NEXT_PUBLIC_ 이름 금지: 브라우저로 나가면 안 됨) */
const SECRET_ENV_NAME = "APP_ACCESS_CODE";

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

/** 글자 하나하나 비교 시간을 일정하게 해서 암호를 추측하기 어렵게 한다 */
function isSameSecret(given: string, expected: string): boolean {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function proxy(request: NextRequest) {
  // 암호가 설정되지 않았으면 모두 막는다 (실수로 열어 두지 않기 위해)
  const secret = process.env[SECRET_ENV_NAME];
  if (!secret) {
    return deny(503, "서버 설정이 아직 끝나지 않았어요.");
  }

  // 1) 너무 자주 요청하면 막는다 (암호를 계속 찍어 보는 시도도 여기서 느려진다)
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

  // 4) 접속 암호가 맞아야 한다
  const given = request.headers.get("x-access-code") ?? "";
  if (!isSameSecret(given, secret)) {
    return deny(401, "접속 암호가 맞지 않아요.");
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/api/:path*",
};
