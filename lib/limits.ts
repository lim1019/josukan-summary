// Design Ref: §9 — 한 번에 받을 최대 쪽수·글자 수. 아직 실측 전의 임시값이다 (실제 스크랩으로 재고 조정).
// 화면(브라우저)과 서버가 같은 숫자를 쓰도록 한 곳에 둔다. 비밀 값이 아니므로 어디서 불러와도 된다.

export const LIMITS = {
  /** 올릴 수 있는 PDF 파일 크기 (MB) */
  maxFileMB: 50,
  /** 한 번에 처리할 최대 쪽수 */
  maxPages: 120,
  /** 모든 쪽을 합친 최대 글자 수 */
  maxTotalChars: 300_000,
} as const;

export const EDITIONS = ["조간", "석간"] as const;
export type Edition = (typeof EDITIONS)[number];
