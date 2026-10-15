import { db } from './db';

/**
 * Database-backed sliding-window limiter, so limits hold across serverless instances.
 * Not strictly atomic (two simultaneous requests can both pass at the boundary);
 * acceptable for brute-force and cost control. Use Redis if you need exact counting.
 */
export async function rateLimit(key: string, max: number, windowMs: number): Promise<{ ok: boolean; retryAfterSec: number }> {
  const since = new Date(Date.now() - windowMs);
  const recent = await db.rateLimitHit.findMany({
    where: { key, createdAt: { gte: since } },
    orderBy: { createdAt: 'asc' },
    select: { createdAt: true },
    take: max,
  });
  if (recent.length >= max) {
    const retryAfterSec = Math.ceil((windowMs - (Date.now() - recent[0].createdAt.getTime())) / 1000);
    return { ok: false, retryAfterSec: Math.max(1, retryAfterSec) };
  }
  await db.rateLimitHit.create({ data: { key } });
  if (Math.random() < 0.02) {
    // opportunistic cleanup of entries older than a day
    await db.rateLimitHit.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 24 * 3600_000) } } }).catch(() => {});
  }
  return { ok: true, retryAfterSec: 0 };
}

/** Account lockout schedule applied on top of the limiter. */
export function lockoutFor(failedLogins: number): number {
  if (failedLogins < 5) return 0;
  return Math.min(60, 2 ** (failedLogins - 5)) * 60_000; // 1,2,4… minutes, capped at 60
}
