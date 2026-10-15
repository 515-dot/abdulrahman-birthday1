// Shared wrapper for AI endpoints: origin check, authentication, permission,
// rate limit, validation, provider call, audit. Each feature only supplies `build`,
// which must load data through the SAME visibility rules as the matching screens.
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { assertSameOrigin, clientIp, errorResponse, requireUser, HttpError } from './auth';
import { AiNotConfiguredError, generate, isAiConfigured } from './ai';
import { rateLimit } from './rate-limit';
import { audit } from './audit';
import { parseBody } from './api';
import type { PermissionKey, Principal } from './permissions';

type Ctx = Awaited<ReturnType<typeof requireUser>>;
export const Lang = z.enum(['ar-EG', 'en']).default('ar-EG');
export const langLine = (l: 'ar-EG' | 'en') => (l === 'ar-EG' ? 'Write in clear Egyptian-friendly Arabic.' : 'Write in English.');

export function aiHandlers<S extends z.ZodTypeAny>(cfg: {
  feature: string;
  permission?: PermissionKey;
  superAdminOnly?: boolean;
  schema: S;
  maxTokens?: number;
  build: (c: { user: Ctx['user']; principal: Principal; input: z.infer<S> }) => Promise<{ system: string; prompt: string; basedOn?: unknown }>;
}) {
  async function GET() {
    try {
      await requireUser();
      return NextResponse.json({ configured: isAiConfigured() });
    } catch (e) { return errorResponse(e); }
  }
  async function POST(req: Request) {
    try {
      assertSameOrigin(req);
      const { user, principal } = await requireUser({ permission: cfg.permission });
      if (cfg.superAdminOnly && !principal.isSuperAdmin) throw new HttpError(403, 'Forbidden');
      if (!(await rateLimit(`ai:${user.id}`, 30, 60 * 60_000)).ok) throw new HttpError(429, 'AI rate limit reached');
      const input = await parseBody(req, cfg.schema);
      const built = await cfg.build({ user, principal, input });
      const text = await generate({ userId: user.id, feature: cfg.feature, system: built.system, prompt: built.prompt, maxTokens: cfg.maxTokens });
      await audit({ actorId: user.id, action: `ai.${cfg.feature}`, ip: clientIp(req) }); // no prompt/response content stored
      return NextResponse.json({ text, basedOn: built.basedOn ?? null });
    } catch (e) {
      if (e instanceof AiNotConfiguredError) {
        return NextResponse.json({ error: 'AI is not configured. Set AI_PROVIDER=anthropic, AI_API_KEY and AI_MODEL on the server.', configured: false }, { status: 503 });
      }
      return errorResponse(e);
    }
  }
  return { GET, POST };
}

export const RULES = 'Use only the facts provided. Never invent prices, availability, dates or promises. If data is missing, say so. Output the result only.';
