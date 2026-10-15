// One-time Super Admin bootstrap. Credentials come from the environment only
// (INITIAL_ADMIN_EMAIL / INITIAL_ADMIN_PASSWORD); nothing is hardcoded.
// Refuses to run if a Super Admin already exists. The account must change its
// password at first login.
import { PrismaClient } from '@prisma/client';
import { hashPassword, passwordProblems } from '../src/lib/password';

async function main() {
  const email = process.env.INITIAL_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.INITIAL_ADMIN_PASSWORD;
  if (!email || !password) throw new Error('Set INITIAL_ADMIN_EMAIL and INITIAL_ADMIN_PASSWORD.');
  const problems = passwordProblems(password);
  if (problems.length) throw new Error(`Password needs: ${problems.join(', ')}`);

  const db = new PrismaClient();
  try {
    if (await db.user.findFirst({ where: { isSuperAdmin: true } })) {
      throw new Error('A Super Admin already exists. Aborting.');
    }
    const user = await db.user.create({
      data: {
        email, fullName: 'Super Admin', isSuperAdmin: true,
        mustChangePassword: true, dataScope: 'ALL',
        credential: { create: { passwordHash: await hashPassword(password) } },
      },
    });
    await db.auditEvent.create({
      data: { actorId: null, action: 'admin.bootstrap', targetType: 'User', targetId: user.id },
    });
    console.log(`Super Admin created: ${email}. Password change required at first login.`);
  } finally {
    await db.$disconnect();
  }
}
main().catch((e) => { console.error(e.message); process.exit(1); });
