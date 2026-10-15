// Design Ref: §2 단계 2, §4 — PDF를 브라우저 안에서 쪽별 글자로 바꾼다 (PDF 원본은 서버로 보내지 않음)
// 브라우저에서만 실행되어야 한다. 서버 코드에서 불러오지 않는다.

export type PdfPage = {
  /** 쪽수 (1부터 시작) */
  page: number;
  /** 그 쪽에서 뽑은 글자 (줄바꿈 포함) */
  text: string;
};

/**
 * PDF 파일에서 쪽별 글자를 뽑는다.
 * 글자가 없는 쪽(스캔본 등)은 text가 빈 문자열로 돌아온다.
 */
export async function extractPages(
  file: File,
  onProgress?: (done: number, total: number) => void,
): Promise<PdfPage[]> {
  // PDF.js는 브라우저 기능을 쓰므로, 서버에서 불러오지 않도록 실행할 때 가져온다.
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();

  const data = new Uint8Array(await file.arrayBuffer());
  const loadingTask = pdfjs.getDocument({ data });
  const doc = await loadingTask.promise;

  try {
    const pages: PdfPage[] = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const content = await page.getTextContent();

      let text = "";
      for (const item of content.items) {
        if ("str" in item) {
          text += item.str;
          if (item.hasEOL) text += "\n";
        }
      }

      pages.push({ page: n, text: text.trim() });
      onProgress?.(n, doc.numPages);
    }
    return pages;
  } finally {
    await loadingTask.destroy();
  }
}
