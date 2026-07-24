import type { Chunk } from './chunking';
import type { Objective } from '../domain/types';

function renderChunks(chunks: Chunk[]): string {
  return chunks.map((c) => `[chunkId=${c.chunkId} page=${c.page}]\n${c.text}`).join('\n\n');
}

/** Draft a grounded learning plan from the source chunks. */
export function planPrompt(chunks: Chunk[]): { system: string; user: string } {
  const system = [
    'You are a curriculum designer. Read the SOURCE MATERIAL and propose 3-5 focused learning',
    'objectives a short quiz could cover. Ground every objective ONLY in the source material — use no',
    'outside knowledge. For each objective, cite one or more sourceRefs using the exact chunkId and page',
    'from the material plus a short excerpt.',
    'Return ONLY JSON of the form:',
    '{ "objectives": [ { "title": string, "difficulty": "easy"|"medium"|"hard",',
    '  "sourceRefs": [ { "page": number, "chunkId": string, "excerpt": string } ] } ] }',
  ].join(' ');
  const user = `SOURCE MATERIAL:\n\n${renderChunks(chunks)}`;
  return { system, user };
}

/** Write one grounded MCQ for a specific objective. */
export function mcqPrompt(objective: Objective, chunks: Chunk[]): { system: string; user: string } {
  const referenced = new Set(objective.sourceRefs.map((r) => r.chunkId));
  const relevant = chunks.filter((c) => referenced.has(c.chunkId));
  const material = relevant.length > 0 ? relevant : chunks;
  const system = [
    'You write multiple-choice questions grounded strictly in the SOURCE MATERIAL (no outside knowledge).',
    'Write ONE question for the given objective. Rules: exactly one defensible correct answer; 3-4 plausible',
    'distractors; 2-3 tiered hints that guide the learner toward the concept WITHOUT naming or quoting the',
    'correct answer; a short explanation of why the correct choice is right; cite sourceRefs (chunkId, page,',
    'excerpt). Choices must use stable ids "a","b","c","d".',
    'Return ONLY JSON of the form:',
    '{ "question": string, "choices": [ { "id": string, "text": string } ], "correctChoiceId": string,',
    '  "explanation": string, "hints": [string], "sourceRefs": [ { "page": number, "chunkId": string, "excerpt": string } ] }',
  ].join(' ');
  const user = `OBJECTIVE: ${objective.title} (difficulty: ${objective.difficulty})\n\nSOURCE MATERIAL:\n\n${renderChunks(material)}`;
  return { system, user };
}
