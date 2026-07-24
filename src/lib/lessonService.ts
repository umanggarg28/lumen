import { randomUUID } from 'crypto';
import { ready } from './db';
import { startPlanning, approvePlan } from '../agent/graph';
import { generateValidMCQ } from '../agent/nodes/mcq';
import { transition } from '../domain/lessonMachine';
import { toPublicMCQ } from '../domain/mcq';
import { grade } from '../domain/grading';
import { summarize, type LessonSummary } from '../domain/summary';
import { initialState } from '../domain/types';
import type { LessonState, LessonPlan, PublicMCQ, Feedback, ObjectiveProgress } from '../domain/types';

/** Everything the client needs to render — and nothing it shouldn't see. */
export interface LessonView {
  lessonId: string;
  phase: LessonState['phase'];
  plan: LessonPlan | null;
  currentObjectiveIndex: number;
  currentQuestion: PublicMCQ | null;
  feedback: Feedback | null;
  progress: ObjectiveProgress[];
  summary: (LessonSummary & { reviewTitles: string[] }) | null;
}

function view(lessonId: string, state: LessonState): LessonView {
  let summary: LessonView['summary'] = null;
  if (state.phase === 'completed') {
    const base = summarize(state.progress);
    const titleOf = (id: string) =>
      state.plan?.objectives.find((o) => o.id === id)?.title ?? id;
    summary = { ...base, reviewTitles: base.reviewObjectiveIds.map(titleOf) };
  }
  return {
    lessonId,
    phase: state.phase,
    plan: state.plan,
    currentObjectiveIndex: state.currentObjectiveIndex,
    currentQuestion: state.currentQuestion,
    feedback: state.feedback,
    progress: state.progress,
    summary,
  };
}

/** Generate the MCQ for the current objective, store its answer key, expose the public shape. */
async function prepareQuestion(state: LessonState): Promise<LessonState> {
  const store = await ready();
  const objective = state.plan!.objectives[state.currentObjectiveIndex];
  const chunks = await store.getChunks(state.documentId!);
  const full = await generateValidMCQ(objective, chunks);
  await store.saveAnswerKey(full.answerKey); // server-side only
  return transition(state, { type: 'QUESTION_READY', question: toPublicMCQ(full) });
}

/** Kick off a lesson: draft the plan (paused at HITL approval). */
export async function startLesson(documentId: string): Promise<LessonView> {
  const store = await ready();
  const lessonId = randomUUID();
  const plan = await startPlanning(lessonId, documentId);
  const state = transition({ ...initialState, documentId }, { type: 'PLAN_DRAFTED', plan });
  await store.saveLesson(lessonId, state);
  return view(lessonId, state);
}

/** Approve (optionally edit) the plan, then serve the first question. */
export async function approveLessonPlan(lessonId: string, editedPlan?: LessonPlan): Promise<LessonView> {
  const store = await ready();
  const loaded = await store.getLesson(lessonId);
  if (!loaded) throw new Error('lesson not found');
  const approved = await approvePlan(lessonId, editedPlan);
  let state: LessonState = { ...loaded, plan: approved };
  state = transition(state, { type: 'APPROVE_PLAN' });
  state = await prepareQuestion(state);
  await store.saveLesson(lessonId, state);
  return view(lessonId, state);
}

/** Grade a submitted answer and return feedback (never the answer). */
export async function submitAnswer(lessonId: string, selectedChoiceId: string): Promise<LessonView> {
  const store = await ready();
  const state = await store.getLesson(lessonId);
  if (!state || !state.currentQuestion) throw new Error('no active question');

  const objectiveId = state.currentQuestion.objectiveId;
  const key = await store.getAnswerKey(state.currentQuestion.id);
  if (!key) throw new Error('answer key missing');

  const correct = grade(key, selectedChoiceId);
  const priorAttempts = state.progress.find((p) => p.objectiveId === objectiveId)?.attempts ?? 0;
  const feedback: Feedback = correct
    ? { status: 'correct', explanation: key.explanation }
    : { status: 'incorrect', hint: key.tieredHints[Math.min(priorAttempts, key.tieredHints.length - 1)] };

  const next = transition(state, { type: 'GRADED', correct, feedback });
  await store.saveAttempt(lessonId, {
    mcqId: key.mcqId,
    objectiveId,
    selectedChoiceId,
    correct,
    attemptNo: priorAttempts + 1,
  });
  await store.saveLesson(lessonId, next);
  return view(lessonId, next);
}

/** Retry the same question after a wrong answer (no penalty). */
export async function retryQuestion(lessonId: string): Promise<LessonView> {
  const store = await ready();
  const state = await store.getLesson(lessonId);
  if (!state) throw new Error('lesson not found');
  const next = transition(state, { type: 'RETRY' });
  await store.saveLesson(lessonId, next);
  return view(lessonId, next);
}

/** Advance after a correct answer: next question, or finish the lesson. */
export async function continueLesson(lessonId: string): Promise<LessonView> {
  const store = await ready();
  const state = await store.getLesson(lessonId);
  if (!state) throw new Error('lesson not found');
  let next = transition(state, { type: 'CONTINUE' });
  if (next.phase === 'preparing_question') {
    next = await prepareQuestion(next);
  }
  await store.saveLesson(lessonId, next);
  return view(lessonId, next);
}

/** Resume an existing lesson (powers refresh-and-continue). */
export async function getLessonView(lessonId: string): Promise<LessonView | null> {
  const store = await ready();
  const state = await store.getLesson(lessonId);
  return state ? view(lessonId, state) : null;
}
