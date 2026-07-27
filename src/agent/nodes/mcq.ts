import { randomUUID } from 'crypto';
import { z } from 'zod';
import { structured } from '../../lib/llm';
import { mcqPrompt, faithfulnessPrompt } from '../../lib/prompts';
import { recordGate } from '../../lib/metrics';
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
/** Fisher-Yates shuffle on a copy — never mutates the input. */
function shuffled<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function assembleMCQ(objective: Objective, raw: RawMCQ): FullMCQ {
  const mcqId = randomUUID();
  return {
    id: mcqId,
    objectiveId: objective.id,
    question: raw.question,
    // Shuffle display order so the correct answer isn't biased toward a fixed slot.
    // Grading is by choice id, so reordering is safe; the answer key is unaffected.
    choices: shuffled(raw.choices),
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

const faithfulnessSchema = z.object({ faithful: z.boolean(), reason: z.string() });

/** The result of fact-checking a question against its source. */
export type Faithfulness = { faithful: boolean; reason: string };

/** A pluggable fact-checker (real one calls the LLM; tests pass a stub). */
export type Verifier = (mcq: FullMCQ, chunks: Chunk[]) => Promise<Faithfulness>;

/**
 * Second, independent LLM pass: given the question, the proposed correct answer,
 * and the cited source, judge whether the answer is actually supported. Structural
 * checks catch malformed questions; this catches confident-but-wrong ones.
 * (Caveat: the judge is also an LLM — this reduces the risk of a bad answer, it
 * doesn't eliminate it.)
 */
export async function checkFaithfulness(
  mcq: FullMCQ,
  chunks: Chunk[],
  structuredImpl = structured,
): Promise<Faithfulness> {
  const correct = mcq.choices.find((c) => c.id === mcq.answerKey.correctChoiceId);
  const { system, user } = faithfulnessPrompt(mcq, correct?.text ?? '', chunks);
  return structuredImpl(faithfulnessSchema, system, user);
}

/**
 * Generate an MCQ and re-generate until it passes BOTH gates, up to `maxAttempts`:
 *   1. structural validation (`validateMCQ`) — well-formed?
 *   2. faithfulness (`verify`) — is the answer actually supported by the source?
 * This is the "self-evaluation framework": the model proposes, code + a judge check,
 * and low-quality or unfaithful output is rejected rather than served.
 */
export async function generateValidMCQ(
  objective: Objective,
  chunks: Chunk[],
  structuredImpl = structured,
  maxAttempts = 2,
  verify: Verifier = (mcq, c) => checkFaithfulness(mcq, c, structuredImpl),
): Promise<FullMCQ> {
  const { system, user } = mcqPrompt(objective, chunks);
  let lastIssues: string[] = [];
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const raw = await structuredImpl(mcqSchema, system, user);
      const mcq = assembleMCQ(objective, raw);

      const { ok, issues } = validateMCQ(mcq); // gate 1: well-formed
      if (!ok) {
        recordGate({ kind: 'structural_reject', objectiveId: objective.id, attempt, detail: issues.join('; ') });
        lastIssues = issues;
        continue;
      }

      const faith = await verify(mcq, chunks); // gate 2: actually supported by the source
      if (!faith.faithful) {
        // This question passed structural checks — the old pipeline would have served it.
        recordGate({ kind: 'faithfulness_reject', objectiveId: objective.id, attempt, detail: faith.reason });
        lastIssues = [`unfaithful: ${faith.reason}`];
        continue;
      }

      recordGate({ kind: 'served', objectiveId: objective.id, attempts: attempt });
      return mcq;
    } catch (err) {
      // Transient model/JSON error — treat as a failed attempt and retry rather than 500.
      recordGate({ kind: 'structural_reject', objectiveId: objective.id, attempt, detail: `error: ${(err as Error).message}` });
      lastIssues = [(err as Error).message];
    }
  }
  recordGate({ kind: 'failed', objectiveId: objective.id, attempts: maxAttempts });
  throw new Error(`Could not generate a valid MCQ after ${maxAttempts} attempts: ${lastIssues.join('; ')}`);
}
