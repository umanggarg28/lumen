import type { LessonState, LessonEvent, ObjectiveProgress } from './types';

/** The id of the objective currently being quizzed. */
function currentObjectiveId(state: LessonState): string {
  return state.plan?.objectives[state.currentObjectiveIndex]?.id ?? '';
}

/**
 * Record one graded attempt against an objective. The first attempt fixes
 * `solvedFirstTry`; later attempts only bump the count. A hint is shown whenever
 * an answer is wrong, so `usedHint` flips true on any incorrect attempt.
 */
function recordAttempt(
  progress: ObjectiveProgress[],
  objectiveId: string,
  correct: boolean,
): ObjectiveProgress[] {
  const existing = progress.find((p) => p.objectiveId === objectiveId);
  if (!existing) {
    return [
      ...progress,
      { objectiveId, attempts: 1, solvedFirstTry: correct, usedHint: !correct, completed: false },
    ];
  }
  return progress.map((p) =>
    p.objectiveId === objectiveId
      ? { ...p, attempts: p.attempts + 1, usedHint: p.usedHint || !correct }
      : p,
  );
}

/** Mark an objective's progress entry as completed. */
function markCompleted(progress: ObjectiveProgress[], objectiveId: string): ObjectiveProgress[] {
  return progress.map((p) => (p.objectiveId === objectiveId ? { ...p, completed: true } : p));
}

/**
 * The lesson state machine, as a pure reducer: given the current state and an
 * event, return the next state. It never mutates its input.
 *
 * Illegal transitions (an event that doesn't apply to the current phase) return
 * the state unchanged — this is what makes the human-approval gate impossible to
 * skip, and stops a wrong answer from being "continued" past.
 */
export function transition(state: LessonState, event: LessonEvent): LessonState {
  switch (event.type) {
    case 'PLAN_DRAFTED': {
      if (state.phase !== 'planning') return state;
      return { ...state, phase: 'awaiting_plan_approval', plan: event.plan };
    }

    case 'APPROVE_PLAN': {
      if (state.phase !== 'awaiting_plan_approval') return state;
      return { ...state, phase: 'preparing_question' };
    }

    case 'QUESTION_READY': {
      if (state.phase !== 'preparing_question') return state;
      return { ...state, phase: 'awaiting_answer', currentQuestion: event.question };
    }

    case 'GRADED': {
      if (state.phase !== 'awaiting_answer') return state;
      return {
        ...state,
        phase: 'showing_feedback',
        feedback: event.feedback,
        progress: recordAttempt(state.progress, currentObjectiveId(state), event.correct),
      };
    }

    case 'RETRY': {
      // Retry only makes sense after a wrong answer; it re-poses the same question.
      if (state.phase !== 'showing_feedback' || state.feedback?.status !== 'incorrect') return state;
      return { ...state, phase: 'awaiting_answer', feedback: null };
    }

    case 'CONTINUE': {
      // Continue only after a correct answer — you can't skip a wrong one.
      if (state.phase !== 'showing_feedback' || state.feedback?.status !== 'correct') return state;
      const progress = markCompleted(state.progress, currentObjectiveId(state));
      const lastIndex = (state.plan?.objectives.length ?? 0) - 1;
      if (state.currentObjectiveIndex >= lastIndex) {
        return { ...state, phase: 'completed', feedback: null, currentQuestion: null, progress };
      }
      return {
        ...state,
        phase: 'preparing_question',
        currentObjectiveIndex: state.currentObjectiveIndex + 1,
        currentQuestion: null,
        feedback: null,
        progress,
      };
    }

    default:
      return state;
  }
}
