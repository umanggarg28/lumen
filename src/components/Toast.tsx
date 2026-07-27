'use client';

import { useEffect } from 'react';

interface Props {
  message: string;
  onDismiss: () => void;
}

/** A single, non-blocking error toast, styled to match the app's surfaces. */
export function Toast({ message, onDismiss }: Props) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 6000);
    return () => clearTimeout(t);
  }, [message, onDismiss]);

  return (
    <div
      role="alert"
      className="fixed bottom-6 left-1/2 z-30 flex w-[min(92vw,440px)] -translate-x-1/2 items-start gap-3 rounded-xl border p-4 shadow-lg animate-fade-up"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      <span
        className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
        style={{ background: 'var(--bad-bg)', color: 'var(--bad)' }}
        aria-hidden
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <line x1="12" y1="8" x2="12" y2="13" />
          <line x1="12" y1="16.5" x2="12" y2="16.5" />
          <circle cx="12" cy="12" r="9" strokeWidth="2" />
        </svg>
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
          Something went wrong
        </p>
        <p className="mt-0.5 text-sm" style={{ color: 'var(--muted)' }}>
          {message}
        </p>
      </div>

      <button
        onClick={onDismiss}
        aria-label="Dismiss"
        className="shrink-0 rounded-md p-1 transition hover:bg-[var(--surface-2)]"
        style={{ color: 'var(--muted)' }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="6" y1="6" x2="18" y2="18" />
          <line x1="18" y1="6" x2="6" y2="18" />
        </svg>
      </button>
    </div>
  );
}
