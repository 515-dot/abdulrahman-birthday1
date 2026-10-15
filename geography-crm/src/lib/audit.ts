import { db } from './db';

const FORBIDDEN_KEYS = /pass|secret|token|hash|authorization|cookie/i;

/** Strip anything that looks like a secret before it can reach the audit log. */
function scrub(meta: Record<string, unknown> | undefined) {
  if (!meta) return undefined;
  return Object.fromEntries(Object.entries(meta).filter(([k]) => !FORBIDDEN_KEYS.test(k)));
}

export async function audit(e: {
  actorId?: string | null;
  action: string;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
  ip?: string | null;
}) {
  await db.auditEvent.create({
    data: {
      actorId: e.actorId ?? null,
      action: e.action,
      targetType: e.targetType,
      targetId: e.targetId,
      metadata: scrub(e.metadata) as never,
      ip: e.ip ?? null,
    },
  });
}
