import Shell from '@/components/Shell';
import { db } from '@/lib/db';
import { requirePage } from '@/lib/guard';

// Salary data is intentionally not loaded on this page.
export default async function HrDashboard() {
  const { user, principal } = await requirePage({ permission: 'hr.view_employee_records' });
  const [people, pending] = await Promise.all([
    db.user.findMany({
      where: { deletedAt: null }, orderBy: { fullName: 'asc' },
      select: { id: true, fullName: true, jobTitle: true, status: true, department: { select: { nameAr: true } } },
    }),
    db.leaveRequest.count({ where: { status: 'PENDING' } }),
  ]);
  return (
    <Shell principal={principal} name={user.fullName} title="الموارد البشرية">
      <div className="mb-4 rounded-2xl border border-line bg-white p-5"><div className="text-sm text-brown">طلبات إجازة قيد الانتظار</div><div className="text-2xl font-bold">{pending}</div></div>
      <div className="overflow-x-auto rounded-2xl border border-line bg-white">
        <table className="w-full text-sm">
          <thead className="bg-surface text-brown"><tr>{['الموظف', 'المسمى', 'القسم', 'الحالة'].map((h) => <th key={h} className="px-4 py-3 text-start">{h}</th>)}</tr></thead>
          <tbody>
            {people.map((p) => (
              <tr key={p.id} className="border-t border-line">
                <td className="px-4 py-3">{p.fullName}</td><td className="px-4 py-3">{p.jobTitle ?? '—'}</td>
                <td className="px-4 py-3">{p.department?.nameAr ?? '—'}</td><td className="px-4 py-3">{p.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Shell>
  );
}
