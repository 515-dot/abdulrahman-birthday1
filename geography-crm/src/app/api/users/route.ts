import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { hashPassword, newToken } from '@/lib/password';
import { audit } from '@/lib/audit';
import { assertSameOrigin, clientIp, errorResponse, requireUser, HttpError } from '@/lib/auth';
import { canGrantPermissions } from '@/lib/permissions';

// NOTE: no `isSuperAdmin` field is accepted here, so it cannot be set through this API.
const CreateBody = z.object({
  fullName: z.string().min(2).max(120),
  email: z.string().email().max(254),
  departmentId: z.string().min(1),
  jobTitle: z.string().max(120).optional(),
  roleIds: z.array(z.string()).min(1).max(5),
  managerId: z.string().optional(),
  teamId: z.string().optional(),
  dataScope: z.enum(['OWN', 'TEAM', 'DEPARTMENT', 'ALL']).default('OWN'),
});

export async function GET() {
  try {
    const { principal } = await requireUser({ permission: 'users.create' });
    void principal;
    const users = await db.user.findMany({
      where: { deletedAt: null },
      select: {
        id: true, fullName: true, email: true, jobTitle: true, status: true, lastLoginAt: true,
        department: { select: { nameAr: true, nameEn: true } },
        roles: { select: { role: { select: { code: true, nameAr: true } } } },
      }, // credentials and HR data are never selected here
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return NextResponse.json({ users });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const { user: actor, principal } = await requireUser({ permission: 'users.create' });
    const parsed = CreateBody.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    const d = parsed.data;
    const email = d.email.trim().toLowerCase();

    // Escalation guard: the actor may only assign roles whose permissions they themselves hold.
    const roles = await db.role.findMany({
      where: { id: { in: d.roleIds } },
      include: { permissions: { include: { permission: true } } },
    });
    if (roles.length !== d.roleIds.length) throw new HttpError(400, 'Unknown role');
    const needed = roles.flatMap((r) => r.permissions.map((p) => p.permission.key));
    if (!canGrantPermissions(principal, needed)) throw new HttpError(403, 'Cannot assign a role exceeding your own permissions');

    if (await db.user.findUnique({ where: { email } })) throw new HttpError(409, 'Email already in use');

    const temporaryPassword = `${newToken().slice(0, 14)}Aa1`; // shown once, must be changed at first login
    const created = await db.user.create({
      data: {
        email, fullName: d.fullName, jobTitle: d.jobTitle, departmentId: d.departmentId,
        managerId: d.managerId, teamId: d.teamId, dataScope: d.dataScope,
        mustChangePassword: true,
        credential: { create: { passwordHash: await hashPassword(temporaryPassword) } },
        roles: { create: d.roleIds.map((roleId) => ({ roleId })) },
      },
      select: { id: true, email: true },
    });
    await audit({
      actorId: actor.id, action: 'user.created', targetType: 'User', targetId: created.id,
      metadata: { roleIds: d.roleIds, departmentId: d.departmentId }, ip: clientIp(req),
    });
    // The temporary password is returned once and never stored or logged in plaintext.
    return NextResponse.json({ id: created.id, email: created.email, temporaryPassword }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
