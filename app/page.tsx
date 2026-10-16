import Link from "next/link";
import UploadForm from "./_components/UploadForm";

// Design Ref: §1.1 — 처음 상태 화면: 앱 이름, 한 줄 설명, 올리기 칸
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

        <UploadForm />

        {/* 개발 중에만 쓰는 임시 도구 링크. 운영(배포)에서는 보이지 않는다. */}
        {process.env.NODE_ENV !== "production" && (
        <div className="flex flex-col gap-1">
          <Link
            href="/dev/demo"
            className="text-sm text-zinc-500 underline underline-offset-4 hover:text-black dark:hover:text-zinc-50"
          >
            개발용: 결과 화면 미리보기 (가상 데이터)
          </Link>
          <Link
            href="/dev/pdf-check"
            className="text-sm text-zinc-500 underline underline-offset-4 hover:text-black dark:hover:text-zinc-50"
          >
            개발용: PDF 구조 확인 도구
          </Link>
        </div>
        )}
      </main>
    </div>
  );
}
