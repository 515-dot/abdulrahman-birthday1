import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { db } from './db';

const COOKIE = 'geo_session';
const secret = () => {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error('SESSION_SECRET must be set (32+ chars).');
  return new TextEncoder().encode(s);
};

const SHORT_MS = 8 * 60 * 60 * 1000;          // 8 hours
const REMEMBER_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

export async function createSession(userId: string, remember: boolean, ip?: string | null, ua?: string | null) {
  const expiresAt = new Date(Date.now() + (remember ? REMEMBER_MS : SHORT_MS));
  const row = await db.session.create({ data: { userId, expiresAt, ip, userAgent: ua?.slice(0, 255) } });
  const jwt = await new SignJWT({ sid: row.id })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
    .sign(secret());
  (await cookies()).set(COOKIE, jwt, {
    httpOnly: true, secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax', path: '/', expires: remember ? expiresAt : undefined,
  });
}

/**
 * The cookie only carries a session id. Validity is re-checked in the database
 * on every request, so suspending an account or revoking a session takes effect immediately.
 */
export async function getSessionUser() {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  let sid: string;
  try {
    const { payload } = await jwtVerify(token, secret());
    sid = String(payload.sid);
  } catch { return null; }

  const s = await db.session.findUnique({
    where: { id: sid },
    include: {
      user: {
        include: {
          department: true,
          roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } },
          permissionGrants: { include: { permission: true } },
          team: true,
        },
      },
    },
  });
  if (!s || s.revokedAt || s.expiresAt < new Date()) return null;
  if (s.user.status !== 'ACTIVE' || s.user.deletedAt) return null;
  return { session: s, user: s.user };
}

export async function destroySession() {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (token) {
    try {
      const { payload } = await jwtVerify(token, secret());
      await db.session.updateMany({ where: { id: String(payload.sid) }, data: { revokedAt: new Date() } });
    } catch { /* already invalid */ }
  }
  store.delete(COOKIE);
}

export const revokeAllSessions = (userId: string) =>
  db.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
