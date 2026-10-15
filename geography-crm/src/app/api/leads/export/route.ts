import { db } from '@/lib/db';
import { audit } from '@/lib/audit';
import { clientIp, errorResponse, requireUser } from '@/lib/auth';
import { leadScopeWhere } from '@/lib/permissions';

// CSV cells beginning with = + - @ are prefixed so spreadsheets do not execute them as formulas.
const cell = (v: unknown) => {
  let s = v == null ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
};

export async function GET(req: Request) {
  try {
    const { user, principal } = await requireUser({ permission: 'leads.export' });
    const leads = await db.lead.findMany({
      where: leadScopeWhere(principal) as never, // export is limited to what the user may already see
      select: { fullName: true, phone: true, email: true, budget: true, createdAt: true, stage: { select: { nameEn: true } }, owner: { select: { fullName: true } } },
      take: 5000,
    });
    await audit({ actorId: user.id, action: 'export.leads', metadata: { count: leads.length }, ip: clientIp(req) });
    const rows = [['Name', 'Phone', 'Email', 'Budget', 'Stage', 'Owner', 'Created'].map(cell).join(',')];
    for (const l of leads) {
      rows.push([l.fullName, l.phone, l.email, l.budget, l.stage.nameEn, l.owner?.fullName, l.createdAt.toISOString()].map(cell).join(','));
    }
    return new Response('﻿' + rows.join('\n'), {
      headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="leads.csv"' },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
