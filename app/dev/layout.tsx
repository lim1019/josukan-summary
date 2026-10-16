import { notFound } from "next/navigation";

// 개발 중에만 쓰는 도구 화면(/dev/...)이다. 운영(배포)에서는 존재하지 않는 주소로 만들어 누구도 열 수 없게 한다.
export default function DevLayout({ children }: { children: React.ReactNode }) {
  if (process.env.NODE_ENV === "production") notFound();
  return children;
}
