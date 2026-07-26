'use client';

import { useEffect, useState } from 'react';
import type { LessonView } from '../domain/view';
import { accentFor } from '../lib/api';
import { Spinner } from './Spinner';

interface Props {
  view: LessonView;
  onAnswer: (choiceId: string) => void;
  onContinue: () => void;
  busy: boolean;
}

export function QuizCard({ view, onAnswer, onContinue, busy }: Props) {
  const q = view.currentQuestion;
  const [selected, setSelected] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<string | null>(null); // the choice currently graded
  const showingFeedback = view.phase === 'showing_feedback';
  const correct = view.feedback?.status === 'correct';
  const locked = showingFeedback && correct; // only lock the question once it's answered right

  // Fresh question -> clear everything.
  useEffect(() => {
    setSelected(null);
    setSubmitted(null);
  }, [q?.id]);

  const objectives = view.plan?.objectives ?? [];

  if (!q) {
    return (
      <div className="mx-auto w-full max-w-2xl px-6 py-24 text-center">
        <Spinner label="Writing your question…" />
      </div>
    );
  }

  function pick(choiceId: string) {
    if (locked || busy) return;
    setSelected(choiceId);
  }

  function submit() {
    if (!selected || busy) return;
    setSubmitted(selected);
    onAnswer(selected);
  }

  function choiceStyle(choiceId: string): React.CSSProperties {
    if (showingFeedback && correct && choiceId === submitted) {
      return { borderColor: 'var(--good)', background: 'var(--good-bg)' };
    }
    if (showingFeedback && !correct && choiceId === submitted) {
      return { borderColor: 'var(--bad)', background: 'var(--bad-bg)' }; // wrong pick stays marked
    }
    if (choiceId === selected) {
      return { borderColor: 'var(--primary)', background: 'color-mix(in srgb, var(--primary) 8%, transparent)' };
    }
    return {};
  }

  // Can submit when there's a selection that hasn't already just been graded.
  const canSubmit = !!selected && !locked && selected !== submitted && !busy;

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
              style={{ background: done || current ? accentFor(i) : 'var(--surface-2)' }}
            />
          );
        })}
      </div>

      <p className="text-sm font-medium text-muted">
        Objective {view.currentObjectiveIndex + 1} of {objectives.length}
        {objectives[view.currentObjectiveIndex] && ` · ${objectives[view.currentObjectiveIndex].title}`}
      </p>

      <div
        key={`${q.id}-${submitted}-${String(showingFeedback && !correct)}`}
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
                disabled={locked || busy}
                onClick={() => pick(c.id)}
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
              {correct ? '✓ Correct' : '✕ Not quite — pick another and try again'}
            </p>
            <p className="mt-1 text-sm" style={{ color: 'var(--text)' }}>
              {correct ? view.feedback.explanation : view.feedback.hint}
            </p>
          </div>
        )}

        {/* actions */}
        <div className="mt-6 flex flex-wrap gap-3">
          {locked ? (
            <button className="btn btn-primary" disabled={busy} onClick={onContinue}>
              {busy ? <Spinner label="Loading…" /> : 'Continue →'}
            </button>
          ) : (
            <button className="btn btn-primary" disabled={!canSubmit} onClick={submit}>
              {busy ? <Spinner label="Checking…" /> : 'Submit answer'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
