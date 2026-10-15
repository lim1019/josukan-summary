import Link from "next/link";

// Design Ref: §1.1 — 처음 상태 화면: 앱 이름과 한 줄 설명. 업로드 칸은 PLAN 작업 3에서 이 자리에 들어온다.
export default function Home() {
  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex w-full max-w-3xl flex-col gap-6 bg-white px-8 py-24 dark:bg-black sm:px-16">
        <h1 className="text-5xl font-bold tracking-tight text-black dark:text-zinc-50">
          조석간 요약
        </h1>
        <p className="max-w-xl text-lg leading-8 text-zinc-600 dark:text-zinc-400">
          재정경제부 관련 조간·석간 신문 스크랩 PDF를 사건별로 묶어 요약하고, 같은 사건을
          보도사마다 어떻게 다뤘는지도 한눈에 보여줘요.
        </p>

        <p
          className="max-w-xl rounded-lg border border-zinc-200 px-4 py-3 text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-400"
          role="status"
        >
          준비 중이에요. 스크랩 PDF를 올리는 기능이 곧 이 자리에 추가돼요.
        </p>

        {/* 개발 중에만 쓰는 임시 도구 링크. /dev/pdf-check를 지울 때 이 링크도 함께 지운다. */}
        <Link
          href="/dev/pdf-check"
          className="text-sm text-zinc-500 underline underline-offset-4 hover:text-black dark:hover:text-zinc-50"
        >
          개발용: PDF 구조 확인 도구
        </Link>
      </main>
    </div>
  );
}
