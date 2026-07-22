// Pure domain types for the lesson agent.
// This module imports nothing framework-specific (no LangGraph, CopilotKit, or DB).
// It defines the vocabulary the whole app reasons in.

/** The phase the lesson is currently in — the state of our state machine. */
export type Phase =
  | 'planning'
  | 'awaiting_plan_approval'
  | 'preparing_question'
  | 'awaiting_answer'
  | 'showing_feedback'
  | 'completed'
  | 'failed';

/** MCQ difficulty band. */
export type Difficulty = 'easy' | 'medium' | 'hard';

/** Where a piece of generated content came from in the source PDF (grounding). */
export interface SourceReference {
  page: number;
  chunkId: string;
  excerpt: string;
}

/** A single learning objective in the plan. */
export interface Objective {
  id: string;
  title: string;
  difficulty: Difficulty;
  sourceRefs: SourceReference[];
}

/** The proposed learning path the user approves. */
export interface LessonPlan {
  objectives: Objective[];
}

/** One selectable answer option. */
export interface Choice {
  id: string;
  text: string;
}

/**
 * Client-safe MCQ — this is the ONLY shape that ever reaches the browser.
 * It deliberately has no correct answer, explanation, or hints. (Answer privacy.)
 */
export interface PublicMCQ {
  id: string;
  objectiveId: string;
  question: string;
  choices: Choice[];
  difficulty: Difficulty;
}

/**
 * Server-only answer material. Stored in Postgres keyed by mcqId; never serialized
 * to the client or placed in graph-synced state.
 */
export interface AnswerKey {
  mcqId: string;
  correctChoiceId: string;
  explanation: string;
  tieredHints: string[];
  sourceRefs: SourceReference[];
}

/** An MCQ together with its answer key — exists only on the server. */
export interface FullMCQ extends PublicMCQ {
  answerKey: AnswerKey;
}

/** Result of grading a submitted answer. */
export interface Feedback {
  status: 'correct' | 'incorrect';
  /** Present only when correct. */
  explanation?: string;
  /** Present only when incorrect. */
  hint?: string;
}

/** Per-objective progress, used for the summary and (later) adaptive difficulty. */
export interface ObjectiveProgress {
  objectiveId: string;
  attempts: number;
  solvedFirstTry: boolean;
  usedHint: boolean;
  completed: boolean;
}

/** The compact lesson state — no PDF text, no answer key, no chain-of-thought. */
export interface LessonState {
  phase: Phase;
  plan: LessonPlan | null;
  currentObjectiveIndex: number;
  currentQuestion: PublicMCQ | null;
  feedback: Feedback | null;
  progress: ObjectiveProgress[];
  error?: string;
}

/**
 * Every input that can drive the state machine. A discriminated union: the `type`
 * field lets TypeScript narrow to the right event shape in a switch.
 */
export type LessonEvent =
  | { type: 'PLAN_DRAFTED'; plan: LessonPlan }
  | { type: 'APPROVE_PLAN' }
  | { type: 'QUESTION_READY'; question: PublicMCQ }
  | { type: 'GRADED'; correct: boolean; feedback: Feedback }
  | { type: 'RETRY' }
  | { type: 'CONTINUE' };

/** The starting state for a fresh lesson. */
export const initialState: LessonState = {
  phase: 'planning',
  plan: null,
  currentObjectiveIndex: 0,
  currentQuestion: null,
  feedback: null,
  progress: [],
};
