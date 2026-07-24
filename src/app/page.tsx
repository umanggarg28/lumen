'use client';

import { useCallback, useEffect, useState } from 'react';
import type { LessonView } from '../domain/view';
import type { LessonPlan } from '../domain/types';
import * as api from '../lib/api';
import { UploadScreen } from '../components/UploadScreen';
import { PlanReview } from '../components/PlanReview';
import { QuizCard } from '../components/QuizCard';
import { ResultsDashboard } from '../components/ResultsDashboard';
import { TutorPanel } from '../components/TutorPanel';
import { Spinner } from '../components/Spinner';

const QUIZ_PHASES = ['preparing_question', 'awaiting_answer', 'showing_feedback'];

const KEY = 'lumen.lessonId';

export default function Home() {
  const [view, setView] = useState<LessonView | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resuming, setResuming] = useState(true);

  // Resume an in-progress lesson after a refresh.
  useEffect(() => {
    const id = localStorage.getItem(KEY);
    if (!id) {
      setResuming(false);
      return;
    }
    api
      .resumeLesson(id)
      .then((v) => {
        if (v) setView(v);
        else localStorage.removeItem(KEY);
      })
      .catch(() => localStorage.removeItem(KEY))
      .finally(() => setResuming(false));
  }, []);

  const run = useCallback(async (fn: () => Promise<LessonView>) => {
    setBusy(true);
    setError(null);
    try {
      const v = await fn();
      setView(v);
      localStorage.setItem(KEY, v.lessonId);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, []);

  const restart = () => {
    localStorage.removeItem(KEY);
    setView(null);
    setError(null);
  };

  function body() {
    if (resuming) {
      return (
        <div className="flex items-center justify-center py-32">
          <Spinner label="Picking up where you left off…" />
        </div>
      );
    }
    if (!view) {
      return <UploadScreen onStart={(doc) => run(() => api.startLesson(doc))} starting={busy} />;
    }
    if (view.phase === 'awaiting_plan_approval') {
      return (
        <PlanReview
          view={view}
          busy={busy}
          onApprove={(edited?: LessonPlan) => run(() => api.approvePlan(view.lessonId, edited))}
        />
      );
    }
    if (view.phase === 'completed') {
      return <ResultsDashboard view={view} onRestart={restart} />;
    }
    return (
      <QuizCard
        view={view}
        busy={busy}
        onAnswer={(choice) => run(() => api.answer(view.lessonId, choice))}
        onRetry={() => run(() => api.retry(view.lessonId))}
        onContinue={() => run(() => api.advance(view.lessonId))}
      />
    );
  }

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-10 border-b" style={{ background: 'color-mix(in srgb, var(--bg) 82%, transparent)', backdropFilter: 'blur(8px)' }}>
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-3.5">
          <button onClick={restart} className="flex items-center gap-2" aria-label="Lumen home">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg text-sm font-bold" style={{ background: 'var(--primary)', color: 'var(--primary-fg)' }}>
              L
            </span>
            <span className="text-lg font-semibold tracking-tight" style={{ fontFamily: 'var(--font-fraunces)' }}>
              Lumen
            </span>
          </button>
          {view && view.phase !== 'completed' && (
            <button className="btn btn-ghost px-3 py-1.5 text-sm" onClick={restart}>
              New lesson
            </button>
          )}
        </div>
      </header>

      <main className="flex-1">{body()}</main>

      {view && QUIZ_PHASES.includes(view.phase) && <TutorPanel lessonId={view.lessonId} />}

      {error && (
        <div
          className="fixed inset-x-0 bottom-6 mx-auto w-fit max-w-[90%] rounded-xl border px-4 py-3 text-sm shadow-lg animate-fade-up"
          style={{ background: 'var(--bad-bg)', borderColor: 'var(--bad-border)', color: 'var(--bad)' }}
          role="alert"
        >
          {error}
          <button className="ml-3 font-semibold underline" onClick={() => setError(null)}>
            dismiss
          </button>
        </div>
      )}
    </div>
  );
}
