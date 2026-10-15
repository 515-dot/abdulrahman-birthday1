import { NextResponse } from 'next/server';
import { getSessionUser } from './session';
import { can, ForbiddenError, type PermissionKey, type Principal } from './permissions';

type SessionUser = NonNullable<Awaited<ReturnType<typeof getSessionUser>>>['user'];

export function toPrincipal(u: SessionUser): Principal {
  const rolePermissions = new Set<string>();
  for (const ur of u.roles) for (const rp of ur.role.permissions) rolePermissions.add(rp.permission.key);
  return {
    id: u.id,
    isSuperAdmin: u.isSuperAdmin,
    status: u.status,
    teamId: u.teamId,
    rolePermissions: [...rolePermissions],
    grants: u.permissionGrants.filter((g) => g.granted).map((g) => g.permission.key),
    revokes: u.permissionGrants.filter((g) => !g.granted).map((g) => g.permission.key),
  };
}

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

/** Use at the top of every protected route handler. Throws 401 / 403 / 428. */
export async function requireUser(opts: { permission?: PermissionKey; allowPasswordChange?: boolean } = {}) {
  const s = await getSessionUser();
  if (!s) throw new HttpError(401, 'Not authenticated');
  if (s.user.mustChangePassword && !opts.allowPasswordChange) {
    throw new HttpError(428, 'Password change required');
  }
  const principal = toPrincipal(s.user);
  if (opts.permission && !can(principal, opts.permission)) throw new ForbiddenError(opts.permission);
  return { user: s.user, principal, sessionId: s.session.id };
}

/** CSRF defence for cookie-authenticated mutations: same-origin only. */
export function assertSameOrigin(req: Request) {
  const origin = req.headers.get('origin');
  const host = req.headers.get('host');
  if (!origin || !host || new URL(origin).host !== host) throw new HttpError(403, 'Bad origin');
}

export function errorResponse(e: unknown) {
  if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
  if (e instanceof ForbiddenError) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  console.error('[api]', e instanceof Error ? e.message : 'unknown error');
  return NextResponse.json({ error: 'Server error' }, { status: 500 });
}

export const clientIp = (req: Request) =>
  req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;
