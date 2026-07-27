import { describe, it, expect, beforeEach } from 'vitest';
import { submitAnswer, tutorReply } from '../../src/lib/lessonService';
import { ready } from '../../src/lib/db';
import { initialState } from '../../src/domain/types';
import type { LessonState, PublicMCQ, AnswerKey } from '../../src/domain/types';

// No DATABASE_URL in tests → the store is the in-memory implementation.
const question: PublicMCQ = {
  id: 'q1',
  objectiveId: 'o1',
  question: 'Which process turns water vapor into droplets?',
  choices: [
    { id: 'a', text: 'Evaporation' },
    { id: 'b', text: 'Condensation' },
  ],
  difficulty: 'easy',
};

const answerKey: AnswerKey = {
  mcqId: 'q1',
  correctChoiceId: 'b',
  explanation: 'Condensation is vapor cooling into liquid droplets.',
  tieredHints: ['Think about cooling.', 'It is the opposite of evaporation.'],
  sourceRefs: [],
};

function awaitingAnswerState(): LessonState {
  return {
    ...initialState,
    documentId: 'd1',
    phase: 'awaiting_answer',
    plan: { objectives: [{ id: 'o1', title: 'The water cycle', difficulty: 'easy', sourceRefs: [] }] },
    currentObjectiveIndex: 0,
    currentQuestion: question,
  };
}

async function seed(lessonId: string) {
  const store = await ready();
  await store.saveLesson(lessonId, awaitingAnswerState());
  await store.saveAnswerKey(answerKey);
}

describe('submitAnswer', () => {
  beforeEach(async () => {
    await seed('L1');
  });

  it('grades a wrong answer as incorrect, shows a hint (not the explanation), and does not advance', async () => {
    const v = await submitAnswer('L1', 'a');
    expect(v.feedback?.status).toBe('incorrect');
    expect(v.feedback?.hint).toBe('Think about cooling.'); // first tier
    expect(v.feedback?.explanation).toBeUndefined();
    expect(v.currentObjectiveIndex).toBe(0);
  });

  it('escalates the hint tier on a second wrong answer (re-answer without an explicit retry)', async () => {
    await submitAnswer('L1', 'a'); // wrong, tier-1 hint
    const v2 = await submitAnswer('L1', 'a'); // wrong again → implicit retry → tier-2 hint
    expect(v2.feedback?.status).toBe('incorrect');
    expect(v2.feedback?.hint).toBe('It is the opposite of evaporation.'); // escalated
  });

  it('grades the correct answer, shows the explanation, and never leaks the answer key', async () => {
    await submitAnswer('L1', 'a'); // wrong first
    const v = await submitAnswer('L1', 'b'); // now correct
    expect(v.feedback?.status).toBe('correct');
    expect(v.feedback?.explanation).toBe('Condensation is vapor cooling into liquid droplets.');
    expect(JSON.stringify(v)).not.toContain('correctChoiceId');
  });
});

describe('tutorReply guard', () => {
  beforeEach(async () => {
    await seed('L2');
  });

  it('refuses when the model reply leaks the correct answer', async () => {
    const leakingChat = async () => 'Easy — the answer is Condensation.';
    const reply = await tutorReply('L2', 'what is the answer?', leakingChat);
    expect(reply).not.toContain('Condensation');
    expect(reply.toLowerCase()).toContain("rather not"); // the refusal message
  });

  it('passes through a safe, grounded reply that does not name the answer', async () => {
    const safeChat = async () => 'Think about what happens to warm air as it rises and cools.';
    const reply = await tutorReply('L2', 'give me a nudge', safeChat);
    expect(reply).toBe('Think about what happens to warm air as it rises and cools.');
  });
});
