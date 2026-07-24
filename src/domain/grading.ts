import type { AnswerKey } from './types';

/**
 * Deterministically grade a submitted answer.
 *
 * The LLM generates content; this pure comparison owns the verdict. No model call,
 * no ambiguity — the same inputs always produce the same result.
 */
export function grade(answerKey: AnswerKey, selectedChoiceId: string): boolean {
  return answerKey.correctChoiceId === selectedChoiceId;
}
