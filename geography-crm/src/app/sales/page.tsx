import Shell from '@/components/Shell';
import { db } from '@/lib/db';
import { requirePage } from '@/lib/guard';
import { leadScopeWhere, can } from '@/lib/permissions';
import LeadForm from '@/components/LeadForm';

export default async function SalesDashboard() {
  const { user, principal } = await requirePage({ permission: 'leads.view_own' });
  const where = leadScopeWhere(principal) as never; // same scope as the API: own / team / all
  const [leads, total, due] = await Promise.all([
    db.lead.findMany({
      where, orderBy: { createdAt: 'desc' }, take: 25,
      select: { id: true, fullName: true, phone: true, nextFollowUpAt: true, stage: { select: { nameAr: true } }, owner: { select: { fullName: true } } },
    }),
    db.lead.count({ where }),
    db.lead.count({ where: { AND: [where, { nextFollowUpAt: { lte: new Date() } }] } as never }),
  ]);
  return (
    <Shell principal={principal} name={user.fullName} title="مساحة المبيعات">
      {can(principal, 'leads.create') && <LeadForm />}
      <div className="mb-4 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-line bg-white p-5"><div className="text-sm text-brown">عملائي المحتملون</div><div className="text-2xl font-bold">{total}</div></div>
        <div className="rounded-2xl border border-line bg-white p-5"><div className="text-sm text-brown">متابعات مستحقة</div><div className="text-2xl font-bold">{due}</div></div>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-line bg-white">
        <table className="w-full text-sm">
          <thead className="bg-surface text-brown"><tr>
            {['الاسم', 'الهاتف', 'المرحلة', 'المسؤول', 'المتابعة القادمة'].map((h) => <th key={h} className="px-4 py-3 text-start">{h}</th>)}
          </tr></thead>
          <tbody>
            {leads.map((l) => (
              <tr key={l.id} className="border-t border-line">
                <td className="px-4 py-3"><a href={`/sales/leads/${l.id}`} className="text-steel underline">{l.fullName}</a></td>
                <td className="px-4 py-3" dir="ltr">{l.phone ?? '—'}</td>
                <td className="px-4 py-3">{l.stage.nameAr}</td>
                <td className="px-4 py-3">{l.owner?.fullName ?? '—'}</td>
                <td className="px-4 py-3">{l.nextFollowUpAt ? l.nextFollowUpAt.toLocaleDateString('ar-EG') : '—'}</td>
              </tr>
            ))}
            {leads.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-brown">لا يوجد عملاء محتملون بعد.</td></tr>}
          </tbody>
        </table>
      </div>
    </Shell>
  );
}
