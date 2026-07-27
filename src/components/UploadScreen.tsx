'use client';

import { useRef, useState } from 'react';
import { uploadPdf, type Extraction } from '../lib/api';
import { Spinner } from './Spinner';

interface Props {
  onStart: (documentId: string) => void;
  starting: boolean;
}

export function UploadScreen({ onStart, starting }: Props) {
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ documentId: string; extraction: Extraction; name: string } | null>(
    null,
  );
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setError('Please choose a PDF file.');
      return;
    }
    setError(null);
    setBusy(true);
    setResult(null);
    try {
      const r = await uploadPdf(file);
      setResult({ ...r, name: file.name });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative isolate mx-auto w-full max-w-2xl px-6 py-16 animate-fade-up">
      <div className="dotted pointer-events-none absolute inset-x-[-40vw] top-0 -z-10 h-[460px]" aria-hidden />
      <div className="text-center">
        <span className="chip" style={{ background: 'var(--surface-2)', color: 'var(--muted)' }}>
          Guided learning from your own material
        </span>
        <h1 className="mt-5 text-4xl sm:text-5xl font-bold leading-[1.08] text-balance">
          Turn any PDF into a <span style={{ color: 'var(--primary)' }}>lesson</span> you actually finish.
        </h1>
        <p className="mt-4 text-lg text-muted max-w-xl mx-auto">
          Lumen reads your document, proposes a learning path you approve, then quizzes you on it —
          one objective at a time, with hints that never hand you the answer.
        </p>
      </div>

      {!result ? (
        <label
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            handleFile(e.dataTransfer.files?.[0]);
          }}
          className="card mt-10 flex flex-col items-center justify-center gap-3 py-14 px-6 text-center cursor-pointer transition"
          style={{ borderStyle: 'dashed', borderColor: drag ? 'var(--primary)' : undefined, background: drag ? 'var(--surface-2)' : undefined }}
        >
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf"
            className="sr-only"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
          <div
            className="flex h-12 w-12 items-center justify-center rounded-2xl text-2xl"
            style={{ background: 'var(--surface-2)' }}
          >
            📄
          </div>
          {busy ? (
            <Spinner label="Reading your PDF…" />
          ) : (
            <>
              <p className="font-semibold text-lg">Drop a PDF here, or click to browse</p>
              <p className="text-sm text-muted">Text-based PDFs work best — scanned pages aren&apos;t OCR&apos;d.</p>
            </>
          )}
        </label>
      ) : (
        <div className="card mt-10 p-6 animate-fade-up">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl text-xl" style={{ background: 'var(--good-bg, var(--surface-2))', color: 'var(--good)' }}>
              ✓
            </div>
            <div className="min-w-0">
              <p className="font-semibold truncate">{result.name}</p>
              <p className="text-sm text-muted">
                Extracted {result.extraction.pageCount} page{result.extraction.pageCount === 1 ? '' : 's'}
                {result.extraction.lowTextPages.length > 0 &&
                  ` · ${result.extraction.lowTextPages.length} with little text`}
              </p>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <button className="btn btn-primary" disabled={starting} onClick={() => onStart(result.documentId)}>
              {starting ? <Spinner label="Planning your lesson…" /> : 'Build my lesson →'}
            </button>
            <button className="btn btn-ghost" disabled={starting} onClick={() => setResult(null)}>
              Choose a different file
            </button>
          </div>
        </div>
      )}

      {error && (
        <div
          className="mt-4 flex items-center gap-2.5 rounded-lg border px-3.5 py-2.5 text-sm animate-fade-up"
          style={{ background: 'var(--bad-bg)', borderColor: 'var(--bad-border)', color: 'var(--text)' }}
          role="alert"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--bad)" strokeWidth="2.5" strokeLinecap="round" className="shrink-0" aria-hidden>
            <line x1="12" y1="8" x2="12" y2="13" />
            <line x1="12" y1="16.5" x2="12" y2="16.5" />
            <circle cx="12" cy="12" r="9" strokeWidth="2" />
          </svg>
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
