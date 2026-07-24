import { describe, it, expect, vi } from 'vitest';
import { assembleMCQ, validateMCQ, generateValidMCQ } from '../../src/agent/nodes/mcq';
import type { Objective } from '../../src/domain/types';

const objective: Objective = {
  id: 'o1',
  title: 'Photosynthesis basics',
  difficulty: 'easy',
  sourceRefs: [{ page: 1, chunkId: 'p1-c0', excerpt: '...' }],
};

const goodRaw = {
  question: 'What do plants primarily use to make energy?',
  choices: [
    { id: 'a', text: 'Sunlight' },
    { id: 'b', text: 'Moonlight' },
    { id: 'c', text: 'Soil minerals only' },
  ],
  correctChoiceId: 'a',
  explanation: 'Plants convert light energy into chemical energy.',
  hints: ['Think about what happens during the day.'],
  sourceRefs: [{ page: 1, chunkId: 'p1-c0', excerpt: '...' }],
};

describe('validateMCQ', () => {
  it('accepts a clean MCQ', () => {
    expect(validateMCQ(assembleMCQ(objective, goodRaw)).ok).toBe(true);
  });

  it('rejects an MCQ whose correct id is not among the choices', () => {
    const bad = assembleMCQ(objective, { ...goodRaw, correctChoiceId: 'z' });
    const { ok, issues } = validateMCQ(bad);
    expect(ok).toBe(false);
    expect(issues.join()).toContain('not one of the choices');
  });

  it('rejects an MCQ whose hint reveals the answer', () => {
    const leaky = assembleMCQ(objective, { ...goodRaw, hints: ['The answer is Sunlight.'] });
    const { ok, issues } = validateMCQ(leaky);
    expect(ok).toBe(false);
    expect(issues.join()).toContain('reveals the correct answer');
  });
});

describe('generateValidMCQ', () => {
  it('retries once past a bad generation, then returns the valid one', async () => {
    const fake = vi
      .fn()
      .mockResolvedValueOnce({ ...goodRaw, correctChoiceId: 'z' }) // invalid
      .mockResolvedValueOnce(goodRaw); // valid
    const mcq = await generateValidMCQ(objective, [], fake, 2);
    expect(fake).toHaveBeenCalledTimes(2);
    expect(mcq.answerKey.correctChoiceId).toBe('a');
    // The answer key rides along server-side, never on the public shape.
    expect(mcq.answerKey).toBeDefined();
  });

  it('throws after exhausting attempts on repeated invalid output', async () => {
    const fake = vi.fn().mockResolvedValue({ ...goodRaw, correctChoiceId: 'z' });
    await expect(generateValidMCQ(objective, [], fake, 2)).rejects.toThrow(/after 2 attempts/);
    expect(fake).toHaveBeenCalledTimes(2);
  });
});
