import { describe, it, expect } from 'vitest';
import { grade } from '../../src/domain/grading';
import type { AnswerKey } from '../../src/domain/types';

const key: AnswerKey = {
  mcqId: 'q1',
  correctChoiceId: 'b',
  explanation: 'B is correct because…',
  tieredHints: [],
  sourceRefs: [],
};

describe('grade', () => {
  it('returns true when the selected choice matches the key', () => {
    expect(grade(key, 'b')).toBe(true);
  });

  it('returns false when the selected choice does not match', () => {
    expect(grade(key, 'a')).toBe(false);
  });
});
