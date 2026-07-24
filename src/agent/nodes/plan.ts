import { z } from 'zod';
import { structured } from '../../lib/llm';
import { planPrompt } from '../../lib/prompts';
import type { Chunk } from '../../lib/chunking';
import type { LessonPlan, Objective } from '../../domain/types';

const planSchema = z.object({
  objectives: z
    .array(
      z.object({
        title: z.string().min(1),
        difficulty: z.enum(['easy', 'medium', 'hard']),
        sourceRefs: z
          .array(z.object({ page: z.number(), chunkId: z.string(), excerpt: z.string() }))
          .min(1),
      }),
    )
    .min(1)
    .max(6),
});

/**
 * Draft a grounded lesson plan from PDF chunks. Objective ids are assigned in
 * code (o1, o2, …) so downstream state never depends on the model inventing ids.
 * `structuredImpl` is injectable so this is testable without a real model.
 */
export async function planLesson(
  chunks: Chunk[],
  structuredImpl = structured,
): Promise<LessonPlan> {
  const { system, user } = planPrompt(chunks);
  const raw = await structuredImpl(planSchema, system, user);
  const objectives: Objective[] = raw.objectives.map((o, i) => ({
    id: `o${i + 1}`,
    title: o.title,
    difficulty: o.difficulty,
    sourceRefs: o.sourceRefs,
  }));
  return { objectives };
}
