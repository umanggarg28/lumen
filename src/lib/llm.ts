import type { ZodType } from 'zod';

/**
 * Minimal provider-agnostic LLM client. Talks to any OpenAI-compatible endpoint
 * (OpenRouter by default), asks for JSON, and validates the response against a
 * Zod schema. Throws if the call fails or the JSON doesn't match the schema —
 * callers (e.g. the MCQ validator) decide how to retry.
 */
const BASE_URL = process.env.OPENROUTER_BASE_URL ?? 'https://openrouter.ai/api/v1';
const MODEL = process.env.OPENROUTER_MODEL ?? 'openai/gpt-4o-mini';

/**
 * Model used for the faithfulness self-check. Defaults to a stronger model than the
 * generator so the judge is a genuinely independent, more capable reviewer (this
 * reduces the correlated-error risk of self-checking with the same model). Falls
 * back to the generation model if not configured.
 */
export const JUDGE_MODEL = process.env.OPENROUTER_JUDGE_MODEL ?? MODEL;

export async function structured<T>(
  schema: ZodType<T>,
  system: string,
  user: string,
  model: string = MODEL,
  fetchImpl: typeof fetch = fetch,
): Promise<T> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY is not set');

  const res = await fetchImpl(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    }),
  });

  if (!res.ok) {
    throw new Error(`LLM request failed (${res.status}): ${await res.text()}`);
  }

  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = data.choices?.[0]?.message?.content ?? '';

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error('LLM returned non-JSON content');
  }
  return schema.parse(parsed);
}

/** Plain-text completion, used for the conversational tutor. */
export async function chat(
  system: string,
  user: string,
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY is not set');

  const res = await fetchImpl(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: 0.4,
    }),
  });

  if (!res.ok) throw new Error(`LLM request failed (${res.status}): ${await res.text()}`);
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return data.choices?.[0]?.message?.content ?? '';
}
