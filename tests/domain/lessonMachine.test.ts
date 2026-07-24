import { describe, it, expect } from 'vitest';
import { transition } from '../../src/domain/lessonMachine';
import { initialState } from '../../src/domain/types';
import type { LessonPlan, LessonState, PublicMCQ, Feedback } from '../../src/domain/types';

const onePlan: LessonPlan = {
  objectives: [{ id: 'o1', title: 'The cell', difficulty: 'easy', sourceRefs: [] }],
};

const twoPlan: LessonPlan = {
  objectives: [
    { id: 'o1', title: 'The cell', difficulty: 'easy', sourceRefs: [] },
    { id: 'o2', title: 'Mitosis', difficulty: 'medium', sourceRefs: [] },
  ],
};

const q1: PublicMCQ = {
  id: 'q1',
  objectiveId: 'o1',
  question: 'What is the basic unit of life?',
  choices: [
    { id: 'a', text: 'Atom' },
    { id: 'b', text: 'Cell' },
  ],
  difficulty: 'easy',
};

const correctFb: Feedback = { status: 'correct', explanation: 'A cell is the basic unit of life.' };
const incorrectFb: Feedback = { status: 'incorrect', hint: 'Think smaller than an organ, bigger than a molecule.' };

/** Drive the machine to awaiting_answer with the given plan and question. */
function readyForAnswer(plan: LessonPlan = twoPlan, q: PublicMCQ = q1): LessonState {
  let s = transition(initialState, { type: 'PLAN_DRAFTED', plan });
  s = transition(s, { type: 'APPROVE_PLAN' });
  s = transition(s, { type: 'QUESTION_READY', question: q });
  return s;
}

describe('transition — plan approval gate', () => {
  it('PLAN_DRAFTED moves planning -> awaiting_plan_approval and stores the plan', () => {
    const s = transition(initialState, { type: 'PLAN_DRAFTED', plan: onePlan });
    expect(s.phase).toBe('awaiting_plan_approval');
    expect(s.plan).toEqual(onePlan);
  });

  it('ignores APPROVE_PLAN while still planning (cannot skip the gate)', () => {
    const s = transition(initialState, { type: 'APPROVE_PLAN' });
    expect(s.phase).toBe('planning');
  });

  it('APPROVE_PLAN after a plan exists moves to preparing_question', () => {
    const drafted = transition(initialState, { type: 'PLAN_DRAFTED', plan: onePlan });
    const s = transition(drafted, { type: 'APPROVE_PLAN' });
    expect(s.phase).toBe('preparing_question');
  });

  it('does not mutate the input state (pure reducer)', () => {
    transition(initialState, { type: 'PLAN_DRAFTED', plan: onePlan });
    expect(initialState.phase).toBe('planning');
    expect(initialState.plan).toBeNull();
  });
});

describe('transition — question, feedback, retry, advance', () => {
  it('QUESTION_READY moves preparing_question -> awaiting_answer and sets the question', () => {
    const s = readyForAnswer();
    expect(s.phase).toBe('awaiting_answer');
    expect(s.currentQuestion).toEqual(q1);
  });

  it('GRADED correct shows an explanation and records a first-try solve', () => {
    const s = transition(readyForAnswer(), { type: 'GRADED', correct: true, feedback: correctFb });
    expect(s.phase).toBe('showing_feedback');
    expect(s.feedback).toEqual(correctFb);
    expect(s.progress[0]).toMatchObject({
      objectiveId: 'o1',
      attempts: 1,
      solvedFirstTry: true,
      usedHint: false,
      completed: false,
    });
  });

  it('GRADED incorrect shows a hint (not an explanation) and does not advance', () => {
    const s = transition(readyForAnswer(), { type: 'GRADED', correct: false, feedback: incorrectFb });
    expect(s.phase).toBe('showing_feedback');
    expect(s.feedback?.status).toBe('incorrect');
    expect(s.feedback?.hint).toBeDefined();
    expect(s.feedback?.explanation).toBeUndefined();
    expect(s.currentObjectiveIndex).toBe(0);
    expect(s.progress[0]).toMatchObject({ attempts: 1, solvedFirstTry: false, usedHint: true });
  });

  it('RETRY after an incorrect answer returns to awaiting_answer with the same question', () => {
    let s = transition(readyForAnswer(), { type: 'GRADED', correct: false, feedback: incorrectFb });
    s = transition(s, { type: 'RETRY' });
    expect(s.phase).toBe('awaiting_answer');
    expect(s.currentQuestion).toEqual(q1);
    expect(s.feedback).toBeNull();
  });

  it('incorrect then correct records two attempts and no first-try solve', () => {
    let s = transition(readyForAnswer(), { type: 'GRADED', correct: false, feedback: incorrectFb });
    s = transition(s, { type: 'RETRY' });
    s = transition(s, { type: 'GRADED', correct: true, feedback: correctFb });
    expect(s.progress[0]).toMatchObject({ attempts: 2, solvedFirstTry: false, usedHint: true });
  });

  it('CONTINUE after correct advances to the next objective when more remain', () => {
    let s = transition(readyForAnswer(), { type: 'GRADED', correct: true, feedback: correctFb });
    s = transition(s, { type: 'CONTINUE' });
    expect(s.phase).toBe('preparing_question');
    expect(s.currentObjectiveIndex).toBe(1);
    expect(s.currentQuestion).toBeNull();
    expect(s.progress[0].completed).toBe(true);
  });

  it('CONTINUE after correct on the last objective completes the lesson', () => {
    let s = transition(readyForAnswer(onePlan), { type: 'GRADED', correct: true, feedback: correctFb });
    s = transition(s, { type: 'CONTINUE' });
    expect(s.phase).toBe('completed');
    expect(s.progress[0].completed).toBe(true);
  });

  it('ignores CONTINUE after an incorrect answer (cannot skip a wrong answer)', () => {
    const s = transition(readyForAnswer(), { type: 'GRADED', correct: false, feedback: incorrectFb });
    const after = transition(s, { type: 'CONTINUE' });
    expect(after.phase).toBe('showing_feedback');
    expect(after.currentObjectiveIndex).toBe(0);
  });
});
