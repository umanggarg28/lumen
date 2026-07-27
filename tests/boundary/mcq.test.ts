import { describe, it, expect, vi } from 'vitest';
import { assembleMCQ, validateMCQ, checkFaithfulness, generateValidMCQ } from '../../src/agent/nodes/mcq';
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

// A verifier stub that always approves — used where we're not testing faithfulness itself.
const alwaysFaithful = async () => ({ faithful: true, reason: 'ok' });

describe('assembleMCQ', () => {
  it('keeps all choices and a valid correct answer regardless of order (choices may be shuffled)', () => {
    const mcq = assembleMCQ(objective, goodRaw);
    // same set of choice texts, correct answer still points at a real choice
    expect(new Set(mcq.choices.map((c) => c.text))).toEqual(new Set(goodRaw.choices.map((c) => c.text)));
    expect(mcq.choices.some((c) => c.id === mcq.answerKey.correctChoiceId)).toBe(true);
    const correct = mcq.choices.find((c) => c.id === mcq.answerKey.correctChoiceId);
    expect(correct?.text).toBe('Sunlight'); // the correct *text* is preserved through shuffling
  });

  it('does not always leave the first-listed option in position 0 (position bias removed)', () => {
    // With a correct-answer-first raw input, shuffling should sometimes move it.
    const firstCorrect = { ...goodRaw, correctChoiceId: 'a' };
    const positions = new Set<number>();
    for (let i = 0; i < 40; i++) {
      const mcq = assembleMCQ(objective, firstCorrect);
      positions.add(mcq.choices.findIndex((c) => c.text === 'Sunlight'));
    }
    expect(positions.size).toBeGreaterThan(1); // the correct answer lands in varied positions
  });
});

describe('validateMCQ (structural)', () => {
  it('accepts a clean MCQ', () => {
    expect(validateMCQ(assembleMCQ(objective, goodRaw)).ok).toBe(true);
  });

  it('rejects an MCQ whose correct id is not among the choices', () => {
    const { ok, issues } = validateMCQ(assembleMCQ(objective, { ...goodRaw, correctChoiceId: 'z' }));
    expect(ok).toBe(false);
    expect(issues.join()).toContain('not one of the choices');
  });

  it('rejects an MCQ whose hint reveals the answer', () => {
    const { ok, issues } = validateMCQ(assembleMCQ(objective, { ...goodRaw, hints: ['The answer is Sunlight.'] }));
    expect(ok).toBe(false);
    expect(issues.join()).toContain('reveals the correct answer');
  });
});

describe('checkFaithfulness (LLM-as-judge)', () => {
  it('passes the judge its verdict through', async () => {
    const judge = vi.fn().mockResolvedValue({ faithful: false, reason: 'source does not support Sunlight' });
    const res = await checkFaithfulness(assembleMCQ(objective, goodRaw), [], judge);
    expect(res.faithful).toBe(false);
    expect(res.reason).toContain('does not support');
    expect(judge).toHaveBeenCalledOnce();
  });

  it('runs the judge on the configured judge model (independent from the generator)', async () => {
    const judge = vi.fn().mockResolvedValue({ faithful: true, reason: 'ok' });
    await checkFaithfulness(assembleMCQ(objective, goodRaw), [], judge);
    // 4th arg is the model the judge call should use
    const modelArg = judge.mock.calls[0][3];
    expect(typeof modelArg).toBe('string');
    expect(modelArg.length).toBeGreaterThan(0);
  });
});

describe('generateValidMCQ', () => {
  it('retries past a structurally-bad generation, then returns the valid one', async () => {
    const gen = vi.fn().mockResolvedValueOnce({ ...goodRaw, correctChoiceId: 'z' }).mockResolvedValueOnce(goodRaw);
    const mcq = await generateValidMCQ(objective, [], gen, 2, alwaysFaithful);
    expect(gen).toHaveBeenCalledTimes(2);
    expect(mcq.answerKey.correctChoiceId).toBe('a');
  });

  it('retries a transient generation error (e.g. malformed JSON) instead of failing the request', async () => {
    const gen = vi
      .fn()
      .mockRejectedValueOnce(new Error('LLM returned non-JSON content')) // transient blip
      .mockResolvedValueOnce(goodRaw);
    const mcq = await generateValidMCQ(objective, [], gen, 2, alwaysFaithful);
    expect(gen).toHaveBeenCalledTimes(2);
    expect(mcq.answerKey.correctChoiceId).toBe('a');
  });

  it('retries a transient error from the faithfulness judge', async () => {
    const gen = vi.fn().mockResolvedValue(goodRaw);
    const verify = vi
      .fn()
      .mockRejectedValueOnce(new Error('judge timed out'))
      .mockResolvedValueOnce({ faithful: true, reason: 'ok' });
    const mcq = await generateValidMCQ(objective, [], gen, 2, verify);
    expect(gen).toHaveBeenCalledTimes(2);
    expect(mcq.answerKey.correctChoiceId).toBe('a');
  });

  it('regenerates when the faithfulness judge rejects a well-formed question', async () => {
    const gen = vi.fn().mockResolvedValue(goodRaw); // always structurally fine
    const verify = vi
      .fn()
      .mockResolvedValueOnce({ faithful: false, reason: 'answer not supported by source' })
      .mockResolvedValueOnce({ faithful: true, reason: 'ok' });
    const mcq = await generateValidMCQ(objective, [], gen, 2, verify);
    expect(gen).toHaveBeenCalledTimes(2);
    expect(verify).toHaveBeenCalledTimes(2);
    expect(mcq.answerKey.correctChoiceId).toBe('a');
  });

  it('throws after exhausting attempts on repeated structural failure', async () => {
    const gen = vi.fn().mockResolvedValue({ ...goodRaw, correctChoiceId: 'z' });
    await expect(generateValidMCQ(objective, [], gen, 2, alwaysFaithful)).rejects.toThrow(/after 2 attempts/);
  });

  it('throws if the question is never judged faithful', async () => {
    const gen = vi.fn().mockResolvedValue(goodRaw);
    const verify = vi.fn().mockResolvedValue({ faithful: false, reason: 'unsupported' });
    await expect(generateValidMCQ(objective, [], gen, 2, verify)).rejects.toThrow(/after 2 attempts/);
  });
});
