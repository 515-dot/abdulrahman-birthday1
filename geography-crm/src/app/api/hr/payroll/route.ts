import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { audit } from '@/lib/audit';
import { assertSameOrigin, clientIp, errorResponse, requireUser, HttpError } from '@/lib/auth';
import { parseBody } from '@/lib/api';

const Body = z.object({
  userId: z.string(),
  period: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  gross: z.number().nonnegative(),
  bonuses: z.number().nonnegative().default(0),
  deductions: z.number().nonnegative().default(0),
});

export async function GET(req: Request) {
  try {
    const { user } = await requireUser({ permission: 'hr.view_salary_records' });
    const period = new URL(req.url).searchParams.get('period') ?? undefined;
    const records = await db.payrollRecord.findMany({ where: period ? { period } : {}, orderBy: { period: 'desc' }, take: 500 });
    await audit({ actorId: user.id, action: 'hr.payroll_viewed', metadata: { period: period ?? 'all', count: records.length }, ip: clientIp(req) });
    return NextResponse.json({ records });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const { user } = await requireUser({ permission: 'hr.manage_payroll' });
    const d = await parseBody(req, Body);
    const net = d.gross + d.bonuses - d.deductions;
    if (net < 0) throw new HttpError(400, 'Deductions exceed gross pay');
    if (!(await db.user.findFirst({ where: { id: d.userId, deletedAt: null } }))) throw new HttpError(404, 'Employee not found');
    await db.payrollRecord.upsert({
      where: { userId_period: { userId: d.userId, period: d.period } },
      update: { gross: d.gross, bonuses: d.bonuses, deductions: d.deductions, net },
      create: { ...d, net },
    });
    // Audit the fact and target, not the amounts.
    await audit({ actorId: user.id, action: 'hr.payroll_saved', targetType: 'User', targetId: d.userId, metadata: { period: d.period }, ip: clientIp(req) });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
