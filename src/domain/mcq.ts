import type { FullMCQ, PublicMCQ } from './types';

/**
 * The single choke point for exposing an MCQ to the client.
 *
 * A FullMCQ carries its answer key (correct choice, explanation, hints) and must
 * never reach the browser. This projection copies only the client-safe fields, so
 * the answer is structurally dropped — there is no code path that ships it.
 */
export function toPublicMCQ(full: FullMCQ): PublicMCQ {
  return {
    id: full.id,
    objectiveId: full.objectiveId,
    question: full.question,
    choices: full.choices,
    difficulty: full.difficulty,
  };
}
