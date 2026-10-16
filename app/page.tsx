import Image from "next/image";
import Link from "next/link";
import UploadForm from "./_components/UploadForm";

// Design Ref: §1.1 — 처음 상태 화면: 앱 이름, 한 줄 설명, 올리기 칸
export default function Home() {
  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex w-full max-w-3xl flex-col gap-6 bg-white px-8 py-24 dark:bg-black sm:px-16">
        {/*
          로고 그림 파일(2000x633)에는 가장자리에 빈 여백이 있다. 여백을 잘라 낸 모양으로 보여줘서,
          로고의 왼쪽 끝이 아래 제목의 왼쪽 끝과 같은 선에 놓이게 한다.
          (그림이 있는 영역: 왼쪽 7.95%·위 14.8% 지점부터, 너비 83.5%·높이 72.2%)
          어두운 화면에서는 로고 글자가 보이도록 로고 둘레에 흰 바탕을 깔되, 자리를 차지하지 않게 그림자로 만든다.
        */}
        <div className="relative h-[40px] w-[148px] overflow-hidden rounded-[2px] dark:bg-white dark:shadow-[0_0_0_8px_#fff]">
          <Image
            src="/mofe-logo.png"
            alt="재정경제부"
            width={2000}
            height={633}
            priority
            style={{ position: "absolute", left: "-14px", top: "-8px", width: "177px", height: "56px", maxWidth: "none" }}
          />
        </div>

        <h1 className="text-4xl font-bold tracking-tight text-black dark:text-zinc-50">
          조·석간 요약
        </h1>
        <p className="max-w-xl text-lg leading-8 text-zinc-600 dark:text-zinc-400">
          재정경제부 관련 조간·석간 신문 스크랩 PDF를 사건별로 묶어 요약하고, 같은 사건을
          보도사마다 어떻게 다뤘는지도 한눈에 보여줘요.
        </p>
        <p className="max-w-xl text-sm text-zinc-500">
          보도 동향을 파악하기 위한 도구예요. 공식 입장이나 공식 자료가 아니며, 요약은 AI가 만들어 틀릴 수 있어요.
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
