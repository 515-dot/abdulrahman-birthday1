import Shell from '@/components/Shell';
import { requirePage } from '@/lib/guard';
import { getCompanyStats } from '@/lib/stats';

const fmt = new Intl.NumberFormat('ar-EG');

function Card({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-5">
      <div className="text-sm text-brown">{label}</div>
      <div className="mt-1 text-2xl font-bold">{typeof value === 'number' ? fmt.format(value) : value}</div>
    </div>
  );
}

function Bars({ title, rows }: { title: string; rows: { label: string; count: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <section className="rounded-2xl border border-line bg-white p-5">
      <h2 className="mb-3 font-semibold">{title}</h2>
      {rows.every((r) => r.count === 0) ? (
        <p className="text-sm text-brown">لا توجد بيانات بعد.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.label} className="text-sm">
              <div className="mb-1 flex justify-between"><span>{r.label}</span><span>{fmt.format(r.count)}</span></div>
              <div className="h-2 rounded bg-brand-50"><div className="h-2 rounded bg-brand" style={{ width: `${(r.count / max) * 100}%` }} /></div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default async function AdminDashboard() {
  const { user, principal } = await requirePage({ superAdmin: true, loginPath: '/admin/login' });
  const s = await getCompanyStats();
  return (
    <Shell principal={principal} name={user.fullName} title="لوحة الإدارة">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card label="إجمالي العملاء المحتملين" value={s.totalLeads} />
        <Card label="عملاء جدد اليوم" value={s.newToday} />
        <Card label="متابعات مستحقة" value={s.followUpsDue} />
        <Card label="صفقات مغلقة" value={s.closedDeals} />
        <Card label="الإيرادات (EGP)" value={s.revenue} />
        <Card label="الموظفون النشطون" value={s.headcount} />
        <Card label="إجازات قيد الانتظار" value={s.pendingLeave} />
        <Card label="تصاميم بانتظار الاعتماد" value={s.awaitingApproval} />
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Bars title="مسار المبيعات" rows={s.pipeline} />
        <Bars title="مصادر العملاء" rows={s.sources} />
      </div>
    </Shell>
  );
}
