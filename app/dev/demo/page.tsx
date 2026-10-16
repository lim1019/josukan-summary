import type { Metadata } from "next";
import Link from "next/link";
import ResultView from "@/app/_components/ResultView";
import { DEMO_EVENTS, DEMO_FLOWS, DEMO_META } from "./demo-data";

export const metadata: Metadata = {
  title: "결과 화면 미리보기 (가상 데이터)",
};

// 결과 화면이 어떻게 보이는지 가상 데이터로 미리 보는 임시 화면. AI·저장소·서버를 쓰지 않는다.
// 배포 전에 app/dev 폴더와 함께 지운다.
export default function DemoPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-10 text-black dark:text-zinc-50">
      <h1 className="text-3xl font-bold tracking-tight">결과 화면 미리보기</h1>
      <p className="mt-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200" role="note">
        이 화면은 <strong>가상 데이터</strong>로 만든 미리보기예요. 보도사 이름, 기사 내용, 숫자는 모두 지어낸 것이며 실제 신문과 관계가 없어요. AI도 저장소도 쓰지 않아요.
      </p>

      <ResultView
        events={DEMO_EVENTS}
        meta={DEMO_META}
        finished
        flows={DEMO_FLOWS}
      />

      <p className="mt-10 text-sm">
        <Link href="/" className="text-zinc-500 underline underline-offset-4">
          첫 화면으로
        </Link>
      </p>
    </main>
  );
}
