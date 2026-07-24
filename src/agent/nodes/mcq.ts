import { randomUUID } from 'crypto';
import { z } from 'zod';
import { structured } from '../../lib/llm';
import { mcqPrompt } from '../../lib/prompts';
import { isHintSafe } from '../../domain/hintGuard';
import type { Chunk } from '../../lib/chunking';
import type { Objective, FullMCQ } from '../../domain/types';

const mcqSchema = z.object({
  question: z.string().min(1),
  choices: z.array(z.object({ id: z.string().min(1), text: z.string().min(1) })).min(2),
  correctChoiceId: z.string().min(1),
  explanation: z.string().min(1),
  hints: z.array(z.string().min(1)).min(1),
  sourceRefs: z.array(z.object({ page: z.number(), chunkId: z.string(), excerpt: z.string() })).min(1),
});
type RawMCQ = z.infer<typeof mcqSchema>;

/** Turn the raw LLM output into a FullMCQ, minting the server-side id + answer key. */
export function assembleMCQ(objective: Objective, raw: RawMCQ): FullMCQ {
  const mcqId = randomUUID();
  return {
    id: mcqId,
    objectiveId: objective.id,
    question: raw.question,
    choices: raw.choices,
    difficulty: objective.difficulty,
    answerKey: {
      mcqId,
      correctChoiceId: raw.correctChoiceId,
      explanation: raw.explanation,
      tieredHints: raw.hints,
      sourceRefs: raw.sourceRefs,
    },
  };
}

/**
 * Self-evaluation gate for a generated MCQ. Deterministic checks: the correct id
 * is a real choice, ids are unique, there's an explanation, and no hint leaks the
 * answer. Returns the list of problems so a retry can be attempted.
 */
export function validateMCQ(mcq: FullMCQ): { ok: boolean; issues: string[] } {
  const issues: string[] = [];
  const ids = mcq.choices.map((c) => c.id);
  const correct = mcq.choices.find((c) => c.id === mcq.answerKey.correctChoiceId);

  if (!correct) issues.push('correctChoiceId is not one of the choices');
  if (new Set(ids).size !== ids.length) issues.push('choice ids are not unique');
  if (mcq.choices.length < 2) issues.push('fewer than two choices');
  if (!mcq.answerKey.explanation.trim()) issues.push('empty explanation');
  if (correct) {
    const leaks = mcq.answerKey.tieredHints.some((h) => !isHintSafe(h, correct.text));
    if (leaks) issues.push('a hint reveals the correct answer');
  }
  return { ok: issues.length === 0, issues };
}

/**
 * Generate an MCQ and re-generate if it fails validation, up to `maxAttempts`.
 * This is the "self-evaluation framework" in miniature: the model proposes, code
 * checks, and low-quality output is rejected rather than served.
 */
export async function generateValidMCQ(
  objective: Objective,
  chunks: Chunk[],
  structuredImpl = structured,
  maxAttempts = 2,
): Promise<FullMCQ> {
  const { system, user } = mcqPrompt(objective, chunks);
  let lastIssues: string[] = [];
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const raw = await structuredImpl(mcqSchema, system, user);
    const mcq = assembleMCQ(objective, raw);
    const { ok, issues } = validateMCQ(mcq);
    if (ok) return mcq;
    lastIssues = issues;
  }
  throw new Error(`Could not generate a valid MCQ after ${maxAttempts} attempts: ${lastIssues.join('; ')}`);
}
