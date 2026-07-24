import { extractText, getDocumentProxy } from 'unpdf';

export interface Page {
  page: number;
  text: string;
}

/** Extract text per page from a PDF. Page numbers are 1-indexed. */
export async function extractPages(data: Uint8Array): Promise<Page[]> {
  const pdf = await getDocumentProxy(data);
  const { text } = await extractText(pdf, { mergePages: false });
  const perPage = Array.isArray(text) ? text : [text];
  return perPage.map((t, i) => ({ page: i + 1, text: (t ?? '').trim() }));
}

/** A quick, honest report of what we got out of the PDF (no OCR — we flag, don't fix). */
export function summarizeExtraction(pages: Page[]): {
  pageCount: number;
  lowTextPages: number[];
} {
  const lowTextPages = pages.filter((p) => p.text.length < 40).map((p) => p.page);
  return { pageCount: pages.length, lowTextPages };
}
