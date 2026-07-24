import type { LessonView } from '../domain/view';
import type { LessonPlan } from '../domain/types';

export interface Extraction {
  pageCount: number;
  lowTextPages: number[];
}

async function json<T>(res: Response): Promise<T> {
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error ?? `Request failed (${res.status})`);
  return data as T;
}

export async function uploadPdf(file: File): Promise<{ documentId: string; extraction: Extraction }> {
  const form = new FormData();
  form.append('file', file);
  return json(await fetch('/api/upload', { method: 'POST', body: form }));
}

async function action(payload: Record<string, unknown>): Promise<LessonView> {
  return json(
    await fetch('/api/lesson', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
  );
}

export const startLesson = (documentId: string) => action({ action: 'start', documentId });
export const approvePlan = (lessonId: string, editedPlan?: LessonPlan) =>
  action({ action: 'approve', lessonId, editedPlan });
export const answer = (lessonId: string, selectedChoiceId: string) =>
  action({ action: 'answer', lessonId, selectedChoiceId });
export const retry = (lessonId: string) => action({ action: 'retry', lessonId });
export const advance = (lessonId: string) => action({ action: 'continue', lessonId });

export async function askTutor(lessonId: string, message: string): Promise<string> {
  const data = await json<{ reply: string }>(
    await fetch('/api/lesson', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'tutor', lessonId, message }),
    }),
  );
  return data.reply;
}

export async function resumeLesson(lessonId: string): Promise<LessonView | null> {
  const res = await fetch(`/api/lesson?lessonId=${encodeURIComponent(lessonId)}`);
  if (res.status === 404) return null;
  return json(res);
}

/** Objective accent color, cycling through the modular palette. */
export function accentFor(index: number): string {
  return `var(--accent-${index % 5})`;
}
