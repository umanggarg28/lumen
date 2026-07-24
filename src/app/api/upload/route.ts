import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { extractPages, summarizeExtraction } from '../../../lib/pdf';
import { chunkPages } from '../../../lib/chunking';
import { ready } from '../../../lib/db';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No file uploaded.' }, { status: 400 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const pages = await extractPages(bytes);
  const extraction = summarizeExtraction(pages);

  if (extraction.pageCount === 0 || extraction.lowTextPages.length === extraction.pageCount) {
    return NextResponse.json(
      { error: 'Could not extract readable text — this looks like a scanned PDF (no OCR).' },
      { status: 422 },
    );
  }

  const chunks = chunkPages(pages);
  const documentId = randomUUID();
  const store = await ready();
  await store.saveChunks(documentId, chunks);

  return NextResponse.json({ documentId, extraction });
}
