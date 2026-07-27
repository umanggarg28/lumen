'use client';

import { useEffect, useRef, useState } from 'react';
import { askTutor } from '../lib/api';
import { Spinner } from './Spinner';

interface Msg {
  role: 'user' | 'tutor';
  text: string;
}

const GREETING: Msg = {
  role: 'tutor',
  text: "Stuck? I can explain a concept, offer an analogy, or point you in the right direction. I won't give away the answer — working it out is part of the learning.",
};

export function TutorPanel({ lessonId }: { lessonId: string }) {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([GREETING]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [msgs, open]);

  async function send() {
    const q = input.trim();
    if (!q || busy) return;
    setInput('');
    setMsgs((m) => [...m, { role: 'user', text: q }]);
    setBusy(true);
    try {
      const reply = await askTutor(lessonId, q);
      setMsgs((m) => [...m, { role: 'tutor', text: reply }]);
    } catch {
      setMsgs((m) => [...m, { role: 'tutor', text: 'Sorry — I had trouble answering just now. Try again?' }]);
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="btn btn-primary fixed bottom-6 right-6 z-20 rounded-full shadow-lg"
        style={{ padding: '0.7rem 1.2rem' }}
      >
        ✨ Ask the tutor
      </button>
    );
  }

  return (
    <div
      className="card fixed bottom-6 right-6 z-20 flex w-[min(92vw,380px)] flex-col overflow-hidden animate-fade-up"
      style={{
        height: 'min(70vh, 520px)',
        boxShadow: '0 6px 16px rgba(20,22,40,0.12), 0 24px 60px rgba(20,22,40,0.22)',
      }}
    >
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md text-xs" style={{ background: 'var(--surface-2)' }}>
            ✨
          </span>
          <span className="font-semibold text-sm">Tutor</span>
        </div>
        <button className="text-muted text-sm hover:opacity-70" onClick={() => setOpen(false)} aria-label="Close tutor">
          ✕
        </button>
      </div>

      <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {msgs.map((m, i) => (
          <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
            <div
              className="max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed"
              style={
                m.role === 'user'
                  ? { background: 'var(--primary)', color: 'var(--primary-fg)', borderBottomRightRadius: 4 }
                  : { background: 'var(--surface-2)', color: 'var(--text)', borderBottomLeftRadius: 4 }
              }
            >
              {m.text}
            </div>
          </div>
        ))}
        {busy && (
          <div className="flex justify-start">
            <div className="rounded-2xl px-3.5 py-2" style={{ background: 'var(--surface-2)' }}>
              <Spinner />
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 border-t p-3">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          placeholder="Explain this to me…"
          className="flex-1 rounded-lg border bg-transparent px-3 py-2 text-sm"
          style={{ borderColor: 'var(--border)' }}
        />
        <button className="btn btn-primary px-3 py-2 text-sm" disabled={busy || !input.trim()} onClick={send}>
          Send
        </button>
      </div>
    </div>
  );
}
