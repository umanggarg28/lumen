import type { Phase, LessonPlan, PublicMCQ, Feedback, ObjectiveProgress } from './types';
import type { LessonSummary } from './summary';

/**
 * The client-facing projection of a lesson. Pure and safe to import in the
 * browser — it can only ever carry public data (no answer keys, no PDF text).
 */
export interface LessonView {
  lessonId: string;
  phase: Phase;
  plan: LessonPlan | null;
  currentObjectiveIndex: number;
  currentQuestion: PublicMCQ | null;
  feedback: Feedback | null;
  progress: ObjectiveProgress[];
  summary: (LessonSummary & { reviewTitles: string[] }) | null;
}
