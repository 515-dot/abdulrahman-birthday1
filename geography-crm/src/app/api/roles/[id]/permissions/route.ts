import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { audit } from '@/lib/audit';
import { assertSameOrigin, clientIp, errorResponse, requireUser, HttpError } from '@/lib/auth';
import { parseBody } from '@/lib/api';
import { PERMISSIONS, canGrantPermissions } from '@/lib/permissions';

const Body = z.object({ permissionKeys: z.array(z.enum(PERMISSIONS)).max(PERMISSIONS.length) });

// Replace a role's permission set. No code change needed to grant or revoke.
export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(req);
    const { user, principal } = await requireUser({ permission: 'roles.manage' });
    const { id } = await ctx.params;
    const { permissionKeys } = await parseBody(req, Body);

    const role = await db.role.findUnique({ where: { id }, include: { permissions: { include: { permission: true } } } });
    if (!role) throw new HttpError(404, 'Not found');
    const before = role.permissions.map((p) => p.permission.key);
    const added = permissionKeys.filter((k) => !before.includes(k));
    // Escalation guard: you cannot add a permission to a role unless you hold it yourself.
    if (!canGrantPermissions(principal, added)) throw new HttpError(403, 'Cannot grant permissions you do not hold');

    const perms = await db.permission.findMany({ where: { key: { in: permissionKeys } } });
    await db.$transaction([
      db.rolePermission.deleteMany({ where: { roleId: id } }),
      db.rolePermission.createMany({ data: perms.map((p) => ({ roleId: id, permissionId: p.id })) }),
    ]);
    await audit({
      actorId: user.id, action: 'role.permissions_changed', targetType: 'Role', targetId: id,
      metadata: { added, removed: before.filter((k) => !permissionKeys.includes(k as never)) }, ip: clientIp(req),
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
