'use client';

import { useState } from 'react';
import type { LessonView } from '../domain/view';
import type { LessonPlan, Objective, Difficulty } from '../domain/types';
import { accentFor } from '../lib/api';
import { Spinner } from './Spinner';

const difficultyStyle: Record<Difficulty, { bg: string; fg: string }> = {
  easy: { bg: 'var(--good-bg)', fg: 'var(--good)' },
  medium: { bg: 'var(--surface-2)', fg: 'var(--muted)' },
  hard: { bg: 'var(--bad-bg)', fg: 'var(--bad)' },
};

interface Props {
  view: LessonView;
  onApprove: (edited?: LessonPlan) => void;
  busy: boolean;
}

export function PlanReview({ view, onApprove, busy }: Props) {
  const original = view.plan?.objectives ?? [];
  const [objectives, setObjectives] = useState<Objective[]>(original);

  const edited = objectives.length !== original.length;
  const remove = (id: string) => setObjectives((os) => os.filter((o) => o.id !== id));

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-12 animate-fade-up">
      <div className="mb-8">
        <span className="chip" style={{ background: 'var(--surface-2)', color: 'var(--muted)' }}>
          Step 1 · Review the plan
        </span>
        <h1 className="mt-4 text-3xl font-bold">Here&apos;s the path I&apos;d take.</h1>
        <p className="mt-2 text-muted">
          Each objective is drawn straight from your PDF. Remove any you don&apos;t want, then approve to
          start.
        </p>
      </div>

      <ol className="flex flex-col gap-3">
        {objectives.map((o, i) => {
          const pages = Array.from(new Set(o.sourceRefs.map((r) => r.page))).sort((a, b) => a - b);
          const d = difficultyStyle[o.difficulty];
          return (
            <li
              key={o.id}
              className="card flex items-start gap-4 p-4 pl-5 animate-fade-up"
              style={{ borderLeft: `4px solid ${accentFor(i)}` }}
            >
              <span
                className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold"
                style={{ background: `color-mix(in srgb, ${accentFor(i)} 16%, transparent)`, color: accentFor(i) }}
              >
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold leading-snug">{o.title}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
                  <span className="chip" style={{ background: d.bg, color: d.fg }}>
                    {o.difficulty}
                  </span>
                  <span>Grounded in {pages.map((p) => `p.${p}`).join(' · ')}</span>
                </div>
              </div>
              <button
                className="btn btn-ghost px-2 py-1 text-sm text-muted"
                onClick={() => remove(o.id)}
                aria-label={`Remove objective ${i + 1}`}
              >
                Remove
              </button>
            </li>
          );
        })}
      </ol>

      <div className="mt-8 flex items-center gap-3">
        <button
          className="btn btn-primary"
          disabled={busy || objectives.length === 0}
          onClick={() => onApprove(edited ? { objectives } : undefined)}
        >
          {busy ? <Spinner label="Writing your first question…" /> : `Approve & start · ${objectives.length} objective${objectives.length === 1 ? '' : 's'}`}
        </button>
        {edited && <span className="text-sm text-muted">Plan edited</span>}
      </div>
    </div>
  );
}
