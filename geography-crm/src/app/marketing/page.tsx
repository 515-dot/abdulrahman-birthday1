import Shell from '@/components/Shell';
import { db } from '@/lib/db';
import { requirePage } from '@/lib/guard';
import { can } from '@/lib/permissions';

export default async function MarketingDashboard() {
  const { user, principal } = await requirePage({ permission: 'marketing.view_campaigns' });
  const budgets = can(principal, 'marketing.manage_budgets');
  const campaigns = await db.campaign.findMany({
    orderBy: { createdAt: 'desc' }, take: 50,
    select: { id: true, name: true, channel: true, budget: true, _count: { select: { leads: true } }, expenses: { select: { amount: true } } },
  });
  return (
    <Shell principal={principal} name={user.fullName} title="مساحة التسويق">
      <div className="overflow-x-auto rounded-2xl border border-line bg-white">
        <table className="w-full text-sm">
          <thead className="bg-surface text-brown"><tr>
            {['الحملة', 'القناة', 'العملاء المحتملون', ...(budgets ? ['الميزانية', 'المصروف'] : [])].map((h) => <th key={h} className="px-4 py-3 text-start">{h}</th>)}
          </tr></thead>
          <tbody>
            {campaigns.map((c) => (
              <tr key={c.id} className="border-t border-line">
                <td className="px-4 py-3">{c.name}</td><td className="px-4 py-3">{c.channel}</td><td className="px-4 py-3">{c._count.leads}</td>
                {budgets && <td className="px-4 py-3">{c.budget ? Number(c.budget) : '—'}</td>}
                {budgets && <td className="px-4 py-3">{c.expenses.reduce((a, e) => a + Number(e.amount), 0)}</td>}
              </tr>
            ))}
            {campaigns.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-brown">لا توجد حملات بعد. مقاييس القنوات الخارجية تظهر بعد ربط التكاملات.</td></tr>}
          </tbody>
        </table>
      </div>
    </Shell>
  );
}
