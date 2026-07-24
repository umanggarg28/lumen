import type { ObjectiveProgress } from './types';

export interface LessonSummary {
  /** Objectives attempted. */
  total: number;
  /** Objectives answered correctly and advanced past. */
  completed: number;
  /** Objectives solved on the first attempt, with no hint. */
  firstTryCount: number;
  /** firstTryCount / total, in [0, 1]. Zero for an empty lesson. */
  firstTryRate: number;
  /** Objectives worth revisiting: not solved first try, or needed a hint. */
  reviewObjectiveIds: string[];
}

/**
 * Build the end-of-lesson report from per-objective progress. The review list is
 * what turns generic "study tips" into concrete topics: anything the learner did
 * not nail on the first try, or needed a hint for.
 */
export function summarize(progress: ObjectiveProgress[]): LessonSummary {
  const total = progress.length;
  const completed = progress.filter((p) => p.completed).length;
  const firstTryCount = progress.filter((p) => p.solvedFirstTry).length;
  const reviewObjectiveIds = progress
    .filter((p) => !p.solvedFirstTry || p.usedHint)
    .map((p) => p.objectiveId);

  return {
    total,
    completed,
    firstTryCount,
    firstTryRate: total === 0 ? 0 : firstTryCount / total,
    reviewObjectiveIds,
  };
}
