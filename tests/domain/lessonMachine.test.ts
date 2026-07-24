import { describe, it, expect } from 'vitest';
import { transition } from '../../src/domain/lessonMachine';
import { initialState } from '../../src/domain/types';
import type { LessonPlan } from '../../src/domain/types';

const plan: LessonPlan = {
  objectives: [{ id: 'o1', title: 'The cell', difficulty: 'easy', sourceRefs: [] }],
};

describe('transition — plan approval gate', () => {
  it('PLAN_DRAFTED moves planning -> awaiting_plan_approval and stores the plan', () => {
    const s = transition(initialState, { type: 'PLAN_DRAFTED', plan });
    expect(s.phase).toBe('awaiting_plan_approval');
    expect(s.plan).toEqual(plan);
  });

  it('ignores APPROVE_PLAN while still planning (cannot skip the gate)', () => {
    const s = transition(initialState, { type: 'APPROVE_PLAN' });
    expect(s.phase).toBe('planning');
  });

  it('APPROVE_PLAN after a plan exists moves to preparing_question', () => {
    const drafted = transition(initialState, { type: 'PLAN_DRAFTED', plan });
    const s = transition(drafted, { type: 'APPROVE_PLAN' });
    expect(s.phase).toBe('preparing_question');
  });

  it('does not mutate the input state (pure reducer)', () => {
    transition(initialState, { type: 'PLAN_DRAFTED', plan });
    expect(initialState.phase).toBe('planning');
    expect(initialState.plan).toBeNull();
  });
});
