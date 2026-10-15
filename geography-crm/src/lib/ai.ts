// Server-side AI access. Nothing here simulates a model: if no provider is
// configured, callers receive a clear "not configured" state and the CRM keeps working.
import { db } from './db';

export const isAiConfigured = () =>
  process.env.AI_PROVIDER === 'anthropic' && !!process.env.AI_API_KEY && !!process.env.AI_MODEL;

export class AiNotConfiguredError extends Error {
  constructor() { super('AI provider is not configured'); }
}

export async function generate(opts: { userId: string; feature: string; system: string; prompt: string }) {
  if (!isAiConfigured()) throw new AiNotConfiguredError();
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': process.env.AI_API_KEY!,   // server-side only
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: process.env.AI_MODEL, max_tokens: 1024,
      system: opts.system, messages: [{ role: 'user', content: opts.prompt }],
    }),
  });
  if (!res.ok) throw new Error(`AI provider error ${res.status}`);
  const data = await res.json();
  await db.aiUsageLog.create({
    data: { userId: opts.userId, feature: opts.feature, promptTokens: data.usage?.input_tokens, outputTokens: data.usage?.output_tokens },
  });
  const text = (data.content ?? []).filter((b: { type: string }) => b.type === 'text').map((b: { text: string }) => b.text).join('\n');
  return text as string;
}
