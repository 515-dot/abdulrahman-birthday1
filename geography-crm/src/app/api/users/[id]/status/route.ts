import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { revokeAllSessions } from '@/lib/session';
import { audit } from '@/lib/audit';
import { assertSameOrigin, clientIp, errorResponse, requireUser, HttpError } from '@/lib/auth';

const Body = z.object({ status: z.enum(['ACTIVE', 'SUSPENDED', 'DEACTIVATED']) });

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(req);
    const { user: actor } = await requireUser({ permission: 'users.create' });
    const { id } = await ctx.params;
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    if (id === actor.id) throw new HttpError(400, 'You cannot change your own account status');

    const target = await db.user.findUnique({ where: { id } });
    if (!target || target.deletedAt) throw new HttpError(404, 'Not found');
    if (target.isSuperAdmin && !actor.isSuperAdmin) throw new HttpError(403, 'Forbidden');

    await db.user.update({ where: { id }, data: { status: parsed.data.status } });
    if (parsed.data.status !== 'ACTIVE') await revokeAllSessions(id); // takes effect immediately
    await audit({
      actorId: actor.id, action: `user.${parsed.data.status.toLowerCase()}`,
      targetType: 'User', targetId: id, ip: clientIp(req),
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
