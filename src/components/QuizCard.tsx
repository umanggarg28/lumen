'use client';

import { useEffect, useState } from 'react';
import type { LessonView } from '../domain/view';
import { accentFor } from '../lib/api';
import { Spinner } from './Spinner';

interface Props {
  view: LessonView;
  onAnswer: (choiceId: string) => void;
  onRetry: () => void;
  onContinue: () => void;
  busy: boolean;
}

export function QuizCard({ view, onAnswer, onRetry, onContinue, busy }: Props) {
  const q = view.currentQuestion;
  const [selected, setSelected] = useState<string | null>(null);
  const showingFeedback = view.phase === 'showing_feedback';
  const correct = view.feedback?.status === 'correct';

  // Reset the selection whenever a new question arrives (or on retry clearing feedback).
  useEffect(() => {
    if (!showingFeedback) setSelected(null);
  }, [q?.id, showingFeedback]);

  const objectives = view.plan?.objectives ?? [];

  if (!q) {
    return (
      <div className="mx-auto w-full max-w-2xl px-6 py-24 text-center">
        <Spinner label="Writing your question…" />
      </div>
    );
  }

  function choiceStyle(choiceId: string): React.CSSProperties {
    const isSel = choiceId === selected;
    if (showingFeedback && isSel) {
      return correct
        ? { borderColor: 'var(--good)', background: 'var(--good-bg)' }
        : { borderColor: 'var(--bad)', background: 'var(--bad-bg)' };
    }
    if (isSel) return { borderColor: 'var(--primary)', background: 'color-mix(in srgb, var(--primary) 8%, transparent)' };
    return {};
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-10">
      {/* progress stepper */}
      <div className="mb-8 flex items-center gap-2" aria-label="Lesson progress">
        {objectives.map((o, i) => {
          const done = view.progress.find((p) => p.objectiveId === o.id)?.completed;
          const current = i === view.currentObjectiveIndex;
          return (
            <div
              key={o.id}
              className="h-1.5 flex-1 rounded-full transition"
              style={{
                background: done || current ? accentFor(i) : 'var(--surface-2)',
                opacity: done ? 1 : current ? 0.9 : 1,
              }}
            />
          );
        })}
      </div>

      <p className="text-sm font-medium text-muted">
        Objective {view.currentObjectiveIndex + 1} of {objectives.length}
        {objectives[view.currentObjectiveIndex] && ` · ${objectives[view.currentObjectiveIndex].title}`}
      </p>

      <div
        key={q.id + String(showingFeedback && !correct)}
        className={`card mt-3 p-6 sm:p-8 ${showingFeedback && !correct ? 'animate-shake' : 'animate-fade-up'}`}
      >
        <h2 className="text-xl font-semibold leading-snug">{q.question}</h2>

        <div className="mt-6 flex flex-col gap-3" role="radiogroup" aria-label="Answer choices">
          {q.choices.map((c) => {
            const isSel = c.id === selected;
            return (
              <button
                key={c.id}
                role="radio"
                aria-checked={isSel}
                disabled={showingFeedback || busy}
                onClick={() => setSelected(c.id)}
                className="flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition disabled:cursor-default"
                style={choiceStyle(c.id)}
              >
                <span
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border"
                  style={{ borderColor: isSel ? 'var(--primary)' : 'var(--border)' }}
                >
                  {isSel && <span className="h-2.5 w-2.5 rounded-full" style={{ background: 'var(--primary)' }} />}
                </span>
                <span>{c.text}</span>
              </button>
            );
          })}
        </div>

        {/* feedback */}
        {showingFeedback && view.feedback && (
          <div
            className={`mt-6 rounded-xl border p-4 ${correct ? 'animate-pop' : 'animate-fade-up'}`}
            style={{
              borderColor: correct ? 'var(--good-border)' : 'var(--bad-border)',
              background: correct ? 'var(--good-bg)' : 'var(--bad-bg)',
            }}
          >
            <p className="font-semibold" style={{ color: correct ? 'var(--good)' : 'var(--bad)' }}>
              {correct ? '✓ Correct' : '✕ Not quite — try again'}
            </p>
            <p className="mt-1 text-sm" style={{ color: 'var(--text)' }}>
              {correct ? view.feedback.explanation : view.feedback.hint}
            </p>
          </div>
        )}

        {/* actions */}
        <div className="mt-6 flex flex-wrap gap-3">
          {!showingFeedback && (
            <button className="btn btn-primary" disabled={!selected || busy} onClick={() => selected && onAnswer(selected)}>
              {busy ? <Spinner label="Checking…" /> : 'Submit answer'}
            </button>
          )}
          {showingFeedback && correct && (
            <button className="btn btn-primary" disabled={busy} onClick={onContinue}>
              {busy ? <Spinner label="Loading…" /> : 'Continue →'}
            </button>
          )}
          {showingFeedback && !correct && (
            <button className="btn btn-primary" disabled={busy} onClick={onRetry}>
              Try again
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
