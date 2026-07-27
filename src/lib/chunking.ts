import type { Page } from './pdf';

export interface Chunk {
  chunkId: string;
  page: number;
  text: string;
}

/**
 * Split pages into bounded, page-aware chunks. Each chunk keeps the page it came
 * from so generated content can cite its source.
 */
export function chunkPages(pages: Page[], maxLen = 1200): Chunk[] {
  const chunks: Chunk[] = [];
  for (const page of pages) {
    if (!page.text.trim()) continue;
    const parts = splitPage(page.text, maxLen);
    parts.forEach((text, i) => {
      chunks.push({ chunkId: `p${page.page}-c${i}`, page: page.page, text });
    });
  }
  return chunks;
}

/**
 * Split one page's text into pieces near `maxLen`.
 *
 * Real PDF text extraction usually strips blank-line paragraph breaks (lines are
 * separated by single newlines, paragraphs are not marked), so a naive
 * split-on-blank-line leaves the whole page as one oversized block. We therefore
 * split progressively — paragraphs, then lines, then sentences, then a hard
 * character cut — down to units that fit, then greedily pack them back up to
 * `maxLen` so chunks stay coherent without blowing the size budget.
 */
function splitPage(text: string, maxLen: number): string[] {
  return pack(atomicUnits(text, maxLen), maxLen);
}

/** Break text into units each no longer than `maxLen`, preferring natural boundaries. */
function atomicUnits(text: string, maxLen: number): string[] {
  // Prefer real paragraphs (blank lines); if there are none, fall back to single lines.
  let blocks = text.split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean);
  if (blocks.length <= 1) blocks = text.split(/\n+/).map((s) => s.trim()).filter(Boolean);

  const units: string[] = [];
  for (const block of blocks) {
    if (block.length <= maxLen) {
      units.push(block);
      continue;
    }
    for (const sentence of splitSentences(block)) {
      if (sentence.length <= maxLen) units.push(sentence);
      else units.push(...hardSplit(sentence, maxLen)); // last resort: no boundary to use
    }
  }
  return units;
}

/** Split after sentence-ending punctuation, keeping the punctuation attached. */
function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Cut a string that has no usable boundary into fixed-size pieces. */
function hardSplit(text: string, maxLen: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < text.length; i += maxLen) out.push(text.slice(i, i + maxLen));
  return out;
}

/** Greedily combine units up to `maxLen`, so small pieces don't become tiny chunks. */
function pack(units: string[], maxLen: number): string[] {
  const out: string[] = [];
  let current = '';
  for (const u of units) {
    if (current && current.length + u.length + 1 > maxLen) {
      out.push(current);
      current = '';
    }
    current = current ? `${current} ${u}` : u;
  }
  if (current) out.push(current);
  return out;
}
