import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword, newToken } from '@/lib/password';
import { revokeAllSessions } from '@/lib/session';
import { audit } from '@/lib/audit';
import { assertSameOrigin, clientIp, errorResponse, requireUser, HttpError } from '@/lib/auth';

// Admin-initiated reset. (Email-based self-service reset needs an SMTP provider, which is not configured.)
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(req);
    const { user: actor } = await requireUser({ permission: 'users.create' });
    const { id } = await ctx.params;
    if (id === actor.id) throw new HttpError(400, 'Use the change-password page for your own account');
    const target = await db.user.findUnique({ where: { id } });
    if (!target || target.deletedAt) throw new HttpError(404, 'Not found');
    if (target.isSuperAdmin && !actor.isSuperAdmin) throw new HttpError(403, 'Forbidden');

    const temporaryPassword = `${newToken().slice(0, 14)}Aa1`;
    await db.$transaction([
      db.credential.upsert({
        where: { userId: id },
        update: { passwordHash: await hashPassword(temporaryPassword) },
        create: { userId: id, passwordHash: await hashPassword(temporaryPassword) },
      }),
      db.user.update({ where: { id }, data: { mustChangePassword: true, failedLogins: 0, lockedUntil: null } }),
    ]);
    await revokeAllSessions(id);
    await audit({ actorId: actor.id, action: 'user.password_reset', targetType: 'User', targetId: id, ip: clientIp(req) });
    return NextResponse.json({ temporaryPassword }); // shown once to the admin, never stored
  } catch (e) {
    return errorResponse(e);
  }
}
