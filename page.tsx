import Shell from '@/components/Shell';
import { db } from '@/lib/db';
import { requirePage } from '@/lib/guard';

export default async function AuditPage() {
  const { user, principal } = await requirePage({ permission: 'audit_logs.view' });
  const events = await db.auditEvent.findMany({ orderBy: { createdAt: 'desc' }, take: 100 });
  return (
    <Shell principal={principal} name={user.fullName} title="سجل التدقيق">
      <div className="overflow-x-auto rounded-2xl border border-line bg-white">
        <table className="w-full text-sm">
          <thead className="bg-surface text-brown"><tr>
            {['الوقت', 'الإجراء', 'المنفّذ', 'الهدف', 'IP'].map((h) => <th key={h} className="px-4 py-3 text-start">{h}</th>)}
          </tr></thead>
          <tbody>
            {events.map((e) => (
              <tr key={e.id} className="border-t border-line">
                <td className="px-4 py-2" dir="ltr">{e.createdAt.toISOString().replace('T', ' ').slice(0, 19)}</td>
                <td className="px-4 py-2" dir="ltr">{e.action}</td>
                <td className="px-4 py-2" dir="ltr">{e.actorId ?? '—'}</td>
                <td className="px-4 py-2" dir="ltr">{e.targetType ? `${e.targetType}:${e.targetId}` : '—'}</td>
                <td className="px-4 py-2" dir="ltr">{e.ip ?? '—'}</td>
              </tr>
            ))}
            {events.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-brown">لا توجد أحداث.</td></tr>}
          </tbody>
        </table>
      </div>
    </Shell>
  );
}
