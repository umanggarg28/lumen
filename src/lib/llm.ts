import type { ZodType } from 'zod';

/**
 * Minimal provider-agnostic LLM client. Talks to any OpenAI-compatible endpoint
 * (OpenRouter by default), asks for JSON, and validates the response against a
 * Zod schema. Throws if the call fails or the JSON doesn't match the schema —
 * callers (e.g. the MCQ validator) decide how to retry.
 */
const BASE_URL = process.env.OPENROUTER_BASE_URL ?? 'https://openrouter.ai/api/v1';
const MODEL = process.env.OPENROUTER_MODEL ?? 'openai/gpt-4o-mini';

export async function structured<T>(
  schema: ZodType<T>,
  system: string,
  user: string,
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
      model: MODEL,
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
