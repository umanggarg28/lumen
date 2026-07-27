import type { Page } from './pdf';

export interface Chunk {
  chunkId: string;
  page: number;
  text: string;
}

/**
 * Split pages into bounded, page-aware chunks. Each chunk keeps the page it came
 * from so generated content can cite its source. Splits on paragraph boundaries,
 * then packs paragraphs up to ~maxLen characters.
 */
export function chunkPages(pages: Page[], maxLen = 1200): Chunk[] {
  const chunks: Chunk[] = [];
  for (const page of pages) {
    if (!page.text) continue;
    const parts = packParagraphs(page.text, maxLen);
    parts.forEach((text, i) => {
      chunks.push({ chunkId: `p${page.page}-c${i}`, page: page.page, text });
    });
  }
  return chunks;
}

function packParagraphs(text: string, maxLen: number): string[] {
  const paragraphs = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const out: string[] = [];
  let current = '';
  for (const para of paragraphs) {
    if (current && current.length + para.length + 2 > maxLen) {
      out.push(current);
      current = '';
    }
    current = current ? `${current}\n\n${para}` : para;
    // Deliberate tradeoff: we never split inside a paragraph, so a paragraph longer
    // than maxLen becomes one oversized chunk. Coherent chunks matter more for
    // grounding than hitting an exact size; sentence-level splitting could be added
    // later for pathologically long paragraphs.
    if (current.length >= maxLen) {
      out.push(current);
      current = '';
    }
  }
  if (current) out.push(current);
  return out;
}
