import type { Metadata } from "next";
import PdfCheck from "./PdfCheck";

export const metadata: Metadata = {
  title: "PDF 구조 확인 (임시 도구)",
};

// PLAN 작업 1: 실제 스크랩 PDF의 구조를 눈으로 확인하는 임시 도구 화면
export default function PdfCheckPage() {
  return <PdfCheck />;
}
