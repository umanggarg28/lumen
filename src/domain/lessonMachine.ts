import type { LessonState, LessonEvent } from './types';

/**
 * The lesson state machine, as a pure reducer: given the current state and an
 * event, return the next state. It never mutates its input.
 *
 * Illegal transitions (an event that doesn't apply to the current phase) return
 * the state unchanged — this is what makes the human-approval gate impossible to
 * skip by firing events out of order.
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

    default:
      return state;
  }
}
