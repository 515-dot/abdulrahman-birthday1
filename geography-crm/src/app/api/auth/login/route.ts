import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { verifyPassword, hashPassword } from '@/lib/password';
import { rateLimit, lockoutFor } from '@/lib/rate-limit';
import { createSession } from '@/lib/session';
import { audit } from '@/lib/audit';
import { assertSameOrigin, clientIp, errorResponse } from '@/lib/auth';
import { workspaceFor } from '@/lib/workspace';

const Body = z.object({
  email: z.string().email().max(254),
  password: z.string().min(1).max(200),
  portal: z.enum(['admin', 'employee']), // which login page was used (not a role choice)
  remember: z.boolean().optional(),
});

const GENERIC = { error: 'Invalid email or password' };
let dummyHash: Promise<string> | undefined; // equalizes timing for unknown emails

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const ip = clientIp(req);
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    const { password, portal, remember } = parsed.data;
    const email = parsed.data.email.trim().toLowerCase();

    const rl = await rateLimit(`login:${ip}:${email}`, 8, 15 * 60_000);
    const rlIp = await rateLimit(`login-ip:${ip}`, 40, 15 * 60_000);
    if (!rl.ok || !rlIp.ok) {
      return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429 });
    }

    const user = await db.user.findUnique({
      where: { email },
      include: { credential: true, roles: { include: { role: true } } },
    });

    if (user?.lockedUntil && user.lockedUntil > new Date()) {
      await db.loginEvent.create({ data: { userId: user.id, email, success: false, ip } });
      return NextResponse.json({ error: 'Account temporarily locked. Try again later.' }, { status: 429 });
    }

    const hash = user?.credential?.passwordHash ?? (await (dummyHash ??= hashPassword('dummy-password-for-timing')));
    const passwordOk = await verifyPassword(hash, password);
    const portalOk = user ? (portal === 'admin' ? user.isSuperAdmin : !user.isSuperAdmin) : false;
    const active = user?.status === 'ACTIVE' && !user.deletedAt;

    if (!user || !passwordOk || !portalOk || !active) {
      if (user && !passwordOk) {
        const failed = user.failedLogins + 1;
        const lockMs = lockoutFor(failed);
        await db.user.update({
          where: { id: user.id },
          data: { failedLogins: failed, lockedUntil: lockMs ? new Date(Date.now() + lockMs) : null },
        });
      }
      await db.loginEvent.create({ data: { userId: user?.id, email, success: false, ip } });
      await audit({ actorId: user?.id, action: 'auth.login_failed', metadata: { portal }, ip });
      return NextResponse.json(GENERIC, { status: 401 }); // same message for every failure cause
    }

    await db.user.update({
      where: { id: user.id },
      data: { failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() },
    });
    await createSession(user.id, !!remember, ip, req.headers.get('user-agent'));
    await db.loginEvent.create({ data: { userId: user.id, email, success: true, ip } });
    await audit({ actorId: user.id, action: 'auth.login', metadata: { portal }, ip });

    return NextResponse.json({
      redirect: user.mustChangePassword ? '/change-password' : workspaceFor(user),
    });
  } catch (e) {
    return errorResponse(e);
  }
}
