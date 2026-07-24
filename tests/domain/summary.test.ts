import { describe, it, expect } from 'vitest';
import { summarize } from '../../src/domain/summary';
import type { ObjectiveProgress } from '../../src/domain/types';

const p = (o: Partial<ObjectiveProgress> & { objectiveId: string }): ObjectiveProgress => ({
  attempts: 1,
  solvedFirstTry: true,
  usedHint: false,
  completed: true,
  ...o,
});

describe('summarize', () => {
  it('returns zeros and no review items for an empty lesson', () => {
    expect(summarize([])).toEqual({
      total: 0,
      completed: 0,
      firstTryCount: 0,
      firstTryRate: 0,
      reviewObjectiveIds: [],
    });
  });

  it('counts completion and first-try solves, and flags topics to review', () => {
    const progress = [
      p({ objectiveId: 'o1', solvedFirstTry: true, usedHint: false, completed: true }),
      p({ objectiveId: 'o2', solvedFirstTry: false, usedHint: true, attempts: 2, completed: true }),
      p({ objectiveId: 'o3', solvedFirstTry: true, usedHint: false, completed: false }),
    ];
    const s = summarize(progress);
    expect(s.total).toBe(3);
    expect(s.completed).toBe(2);
    expect(s.firstTryCount).toBe(2);
    expect(s.firstTryRate).toBeCloseTo(2 / 3);
    expect(s.reviewObjectiveIds).toEqual(['o2']);
  });
});
