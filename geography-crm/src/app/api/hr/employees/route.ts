import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { audit } from '@/lib/audit';
import { clientIp, errorResponse, requireUser } from '@/lib/auth';
import { can } from '@/lib/permissions';

// Directory data only. Salary is served by a separate endpoint with its own permission.
export async function GET(req: Request) {
  try {
    const { user, principal } = await requireUser({ permission: 'hr.view_employee_records' });
    const withSalary = new URL(req.url).searchParams.get('salary') === '1';
    const people = await db.user.findMany({
      where: { deletedAt: null },
      select: {
        id: true, fullName: true, email: true, jobTitle: true, status: true,
        department: { select: { nameAr: true } }, manager: { select: { fullName: true } },
      },
      orderBy: { fullName: 'asc' },
    });
    if (!withSalary) return NextResponse.json({ employees: people });

    if (!can(principal, 'hr.view_salary_records')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const salaries = await db.salaryRecord.findMany({ orderBy: { effectiveFrom: 'desc' } });
    const latest = new Map<string, number>();
    for (const s of salaries) if (!latest.has(s.userId)) latest.set(s.userId, Number(s.baseSalary));
    await audit({ actorId: user.id, action: 'hr.salary_viewed', metadata: { count: people.length }, ip: clientIp(req) });
    return NextResponse.json({ employees: people.map((p) => ({ ...p, baseSalary: latest.get(p.id) ?? null })) });
  } catch (e) {
    return errorResponse(e);
  }
}
