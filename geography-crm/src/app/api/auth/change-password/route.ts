import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { hashPassword, verifyPassword, passwordProblems } from '@/lib/password';
import { revokeAllSessions, createSession } from '@/lib/session';
import { audit } from '@/lib/audit';
import { assertSameOrigin, clientIp, errorResponse, requireUser } from '@/lib/auth';
import { workspaceFor } from '@/lib/workspace';

const Body = z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(1).max(200) });

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const { user } = await requireUser({ allowPasswordChange: true });
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });

    const cred = await db.credential.findUnique({ where: { userId: user.id } });
    if (!cred || !(await verifyPassword(cred.passwordHash, parsed.data.currentPassword))) {
      return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 });
    }
    const problems = passwordProblems(parsed.data.newPassword);
    if (problems.length) return NextResponse.json({ error: `Password needs: ${problems.join(', ')}` }, { status: 400 });
    if (parsed.data.newPassword === parsed.data.currentPassword) {
      return NextResponse.json({ error: 'Choose a different password' }, { status: 400 });
    }

    await db.$transaction([
      db.credential.update({ where: { userId: user.id }, data: { passwordHash: await hashPassword(parsed.data.newPassword) } }),
      db.user.update({ where: { id: user.id }, data: { mustChangePassword: false } }),
    ]);
    await revokeAllSessions(user.id);            // sign out every other device
    await createSession(user.id, false, clientIp(req), req.headers.get('user-agent'));
    await audit({ actorId: user.id, action: 'auth.password_changed', ip: clientIp(req) });

    const fresh = await db.user.findUniqueOrThrow({ where: { id: user.id }, include: { roles: { include: { role: true } } } });
    return NextResponse.json({ redirect: workspaceFor(fresh) });
  } catch (e) {
    return errorResponse(e);
  }
}
