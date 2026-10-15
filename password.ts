import { hash, verify } from '@node-rs/argon2';
import { createHash, randomBytes } from 'node:crypto';

// Argon2id (algorithm: 2). Parameters follow OWASP's minimum recommendations.
const OPTS = { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

export const hashPassword = (plain: string) => hash(plain, OPTS);

export async function verifyPassword(stored: string, plain: string): Promise<boolean> {
  try { return await verify(stored, plain); } catch { return false; }
}

/** Minimum policy; tighten as needed. */
export function passwordProblems(pw: string): string[] {
  const p: string[] = [];
  if (pw.length < 12) p.push('at least 12 characters');
  if (!/[a-z]/.test(pw) || !/[A-Z]/.test(pw)) p.push('upper and lower case letters');
  if (!/\d/.test(pw)) p.push('a digit');
  return p;
}

export const newToken = () => randomBytes(32).toString('base64url');
export const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
