// In-memory sliding-window limiter (single instance). For multi-instance
// deployments replace the Map with Redis or a database-backed store.
const hits = new Map<string, number[]>();

export function rateLimit(key: string, max: number, windowMs: number): { ok: boolean; retryAfterSec: number } {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= max) {
    hits.set(key, recent);
    return { ok: false, retryAfterSec: Math.ceil((windowMs - (now - recent[0])) / 1000) };
  }
  recent.push(now);
  hits.set(key, recent);
  return { ok: true, retryAfterSec: 0 };
}

/** Account lockout schedule applied on top of the limiter. */
export function lockoutFor(failedLogins: number): number {
  if (failedLogins < 5) return 0;
  return Math.min(60, 2 ** (failedLogins - 5)) * 60_000; // 1,2,4… minutes, capped at 60
}
