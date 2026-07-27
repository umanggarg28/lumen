import { describe, it, expect } from 'vitest';
import { chunkPages } from '../../src/lib/chunking';
import type { Page } from '../../src/lib/pdf';

describe('chunkPages', () => {
  it('tags every chunk with the page it came from', () => {
    const pages: Page[] = [
      { page: 1, text: 'Alpha paragraph.' },
      { page: 2, text: 'Beta paragraph.' },
    ];
    const chunks = chunkPages(pages);
    expect(chunks.every((c) => typeof c.page === 'number')).toBe(true);
    expect(chunks.find((c) => c.text.includes('Alpha'))?.page).toBe(1);
    expect(chunks.find((c) => c.text.includes('Beta'))?.page).toBe(2);
  });

  it('gives every chunk a unique id', () => {
    const pages: Page[] = [{ page: 1, text: 'a\n\nb\n\nc' }];
    const ids = chunkPages(pages).map((c) => c.chunkId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('skips empty pages', () => {
    const pages: Page[] = [
      { page: 1, text: '' },
      { page: 2, text: 'real content' },
    ];
    const chunks = chunkPages(pages);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].page).toBe(2);
  });

  // The real-PDF case: extracted text has single newlines between lines and NO
  // blank-line paragraph breaks. A long page must still be split near maxLen.
  it('splits a long, single-newline page (real-PDF style) into multiple bounded chunks', () => {
    const line = 'This is a sentence of a reasonable length that stands on its own line.';
    const text = Array.from({ length: 60 }, () => line).join('\n'); // ~4200 chars, no blank lines
    const pages: Page[] = [{ page: 1, text }];

    const chunks = chunkPages(pages, 1200);

    expect(chunks.length).toBeGreaterThan(1); // must NOT be one giant chunk
    for (const c of chunks) {
      // allow a little slack for the boundary sentence, but nowhere near a whole page
      expect(c.text.length).toBeLessThanOrEqual(1400);
      expect(c.page).toBe(1);
    }
    // nothing lost: all the text survives across the chunks
    const joinedLen = chunks.reduce((n, c) => n + c.text.length, 0);
    expect(joinedLen).toBeGreaterThanOrEqual(text.length - chunks.length * 2);
  });

  it('splits an unbroken block with no newlines at all (worst case) by sentences', () => {
    const sentence = 'Photosynthesis converts light into chemical energy in plants. ';
    const text = sentence.repeat(40).trim(); // ~2400 chars, zero newlines
    const chunks = chunkPages([{ page: 1, text }], 1200);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) expect(c.text.length).toBeLessThanOrEqual(1400);
  });
});
