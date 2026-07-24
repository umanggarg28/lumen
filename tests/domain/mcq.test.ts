import { describe, it, expect } from 'vitest';
import { toPublicMCQ } from '../../src/domain/mcq';
import type { FullMCQ } from '../../src/domain/types';

const full: FullMCQ = {
  id: 'q1',
  objectiveId: 'o1',
  question: 'What process do plants use to convert sunlight into energy?',
  difficulty: 'easy',
  choices: [
    { id: 'a', text: 'Respiration' },
    { id: 'b', text: 'Photosynthesis' },
  ],
  answerKey: {
    mcqId: 'q1',
    correctChoiceId: 'b',
    explanation: 'because photosynthesis converts light to chemical energy',
    tieredHints: ['think about what leaves do in sunlight'],
    sourceRefs: [{ page: 3, chunkId: 'c3', excerpt: '...' }],
  },
};

describe('toPublicMCQ', () => {
  it('keeps only the client-safe fields', () => {
    const pub = toPublicMCQ(full);
    expect(Object.keys(pub).sort()).toEqual([
      'choices',
      'difficulty',
      'id',
      'objectiveId',
      'question',
    ]);
  });

  it('never leaks the answer, explanation, hints, or answerKey', () => {
    const serialized = JSON.stringify(toPublicMCQ(full));
    expect(serialized).not.toContain('correctChoiceId');
    expect(serialized).not.toContain('answerKey');
    expect(serialized).not.toContain('because photosynthesis');
    expect(serialized).not.toContain('think about what leaves do');
  });
});
