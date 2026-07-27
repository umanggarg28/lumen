'use client';

import type { LessonView } from '../domain/view';
import { accentFor } from '../lib/api';

interface Props {
  view: LessonView;
  onRestart: () => void;
}

export function ResultsDashboard({ view, onRestart }: Props) {
  const s = view.summary;
  const objectives = view.plan?.objectives ?? [];
  const pct = s ? Math.round(s.firstTryRate * 100) : 0;

  const tips: string[] = [];
  if (s) {
    if (s.reviewTitles.length > 0) {
      tips.push(`Revisit these topics first: ${s.reviewTitles.join(', ')}.`);
    }
    if (pct >= 80) tips.push('Strong first-attempt accuracy — try a harder document next to keep stretching.');
    else if (pct >= 40) tips.push('Solid start. Re-read the sections behind the flagged topics, then retake.');
    else tips.push('Give the source another close read before retrying — focus on the flagged topics.');
    tips.push('Space your review: a quick re-quiz tomorrow will lock this in far better than cramming now.');
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-12 animate-fade-up">
      <span className="chip" style={{ background: 'var(--surface-2)', color: 'var(--muted)' }}>
        Lesson complete
      </span>
      <h1 className="mt-4 text-3xl font-bold">Nice work — here&apos;s how it went.</h1>

      {/* headline stats */}
      <div className="mt-6 grid grid-cols-2 gap-4">
        <div className="card p-5">
          <p className="text-sm text-muted">Solved on first try</p>
          <p className="mt-1 text-3xl font-bold" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {pct}%
          </p>
          <div className="mt-3 h-2 rounded-full" style={{ background: 'var(--surface-2)' }}>
            <div className="h-2 rounded-full transition-all" style={{ width: `${pct}%`, background: 'var(--primary)' }} />
          </div>
        </div>
        <div className="card p-5">
          <p className="text-sm text-muted">Objectives completed</p>
          <p className="mt-1 text-3xl font-bold" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {s?.completed ?? 0}
            <span className="text-lg text-muted"> / {s?.total ?? objectives.length}</span>
          </p>
          <div className="mt-3 h-2 rounded-full" style={{ background: 'var(--surface-2)' }}>
            <div
              className="h-2 rounded-full transition-all"
              style={{
                width: `${s && s.total ? Math.round((s.completed / s.total) * 100) : 0}%`,
                background: 'var(--accent-4)',
              }}
            />
          </div>
        </div>
      </div>

      {/* per-objective mastery */}
      <div className="card mt-4 p-5">
        <p className="text-sm font-semibold text-muted">By objective</p>
        <ul className="mt-4 flex flex-col gap-4">
          {objectives.map((o, i) => {
            const p = view.progress.find((x) => x.objectiveId === o.id);
            const fill = p?.solvedFirstTry ? 100 : p?.completed ? 60 : 15;
            const note = p?.solvedFirstTry
              ? 'First try'
              : p?.usedHint
                ? `With hints · ${p.attempts} attempt${p.attempts === 1 ? '' : 's'}`
                : p?.completed
                  ? `${p.attempts} attempts`
                  : 'Incomplete';
            return (
              <li key={o.id}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm font-medium truncate">{o.title}</span>
                  <span className="text-xs text-muted shrink-0">{note}</span>
                </div>
                <div className="mt-1.5 h-2 rounded-full" style={{ background: 'var(--surface-2)' }}>
                  <div className="h-2 rounded-full transition-all" style={{ width: `${fill}%`, background: accentFor(i) }} />
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {/* review + study tips */}
      {s && s.reviewTitles.length > 0 && (
        <div className="card mt-4 p-5">
          <p className="text-sm font-semibold text-muted">Review queue</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {s.reviewTitles.map((t) => (
              <span key={t} className="chip" style={{ background: 'var(--surface-2)', color: 'var(--text)' }}>
                {t}
              </span>
            ))}
          </div>
        </div>
      )}

      {tips.length > 0 && (
        <div className="card mt-4 p-5">
          <p className="text-sm font-semibold text-muted">Study tips</p>
          <ul className="mt-3 flex flex-col gap-2 text-sm">
            {tips.map((t, i) => (
              <li key={i} className="flex gap-2">
                <span aria-hidden style={{ color: 'var(--primary)' }}>•</span>
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <button className="btn btn-primary mt-8" onClick={onRestart}>
        Start a new lesson
      </button>
    </div>
  );
}
