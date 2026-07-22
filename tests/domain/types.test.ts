import { describe, it, expect } from 'vitest';
import { initialState } from '../../src/domain/types';

describe('initialState', () => {
  it('starts in the planning phase with empty progress', () => {
    expect(initialState.phase).toBe('planning');
    expect(initialState.plan).toBeNull();
    expect(initialState.currentObjectiveIndex).toBe(0);
    expect(initialState.currentQuestion).toBeNull();
    expect(initialState.feedback).toBeNull();
    expect(initialState.progress).toEqual([]);
  });
});
