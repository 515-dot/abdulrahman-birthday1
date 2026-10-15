import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { audit } from '@/lib/audit';
import { assertSameOrigin, clientIp, errorResponse, requireUser, HttpError } from '@/lib/auth';
import { parseBody } from '@/lib/api';
import { PERMISSIONS, canGrantPermissions } from '@/lib/permissions';
import { revokeAllSessions } from '@/lib/session';

const Body = z.object({ grants: z.array(z.enum(PERMISSIONS)), revokes: z.array(z.enum(PERMISSIONS)) });

// Per-user overrides on top of roles: explicit grants and explicit revocations.
export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(req);
    const { user, principal } = await requireUser({ permission: 'roles.manage' });
    const { id } = await ctx.params;
    const { grants, revokes } = await parseBody(req, Body);
    if (grants.some((g) => revokes.includes(g))) throw new HttpError(400, 'A permission cannot be both granted and revoked');
    if (!canGrantPermissions(principal, grants)) throw new HttpError(403, 'Cannot grant permissions you do not hold');

    const target = await db.user.findUnique({ where: { id } });
    if (!target || target.deletedAt) throw new HttpError(404, 'Not found');
    if (target.isSuperAdmin && !user.isSuperAdmin) throw new HttpError(403, 'Forbidden');

    const perms = await db.permission.findMany({ where: { key: { in: [...grants, ...revokes] } } });
    const idOf = new Map(perms.map((p) => [p.key, p.id]));
    await db.$transaction([
      db.userPermission.deleteMany({ where: { userId: id } }),
      db.userPermission.createMany({
        data: [
          ...grants.map((k) => ({ userId: id, permissionId: idOf.get(k)!, granted: true })),
          ...revokes.map((k) => ({ userId: id, permissionId: idOf.get(k)!, granted: false })),
        ],
      }),
    ]);
    await revokeAllSessions(id); // forces re-login so the change applies cleanly
    await audit({ actorId: user.id, action: 'user.permissions_changed', targetType: 'User', targetId: id, metadata: { grants, revokes }, ip: clientIp(req) });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
