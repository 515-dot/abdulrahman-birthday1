import Shell from '@/components/Shell';
import { db } from '@/lib/db';
import { requirePage } from '@/lib/guard';
import { can } from '@/lib/permissions';

const FLOW = ['BRIEF_RECEIVED', 'IN_PROGRESS', 'INTERNAL_REVIEW', 'REVISIONS_REQUIRED', 'APPROVED', 'DELIVERED'];
const LABEL: Record<string, string> = {
  BRIEF_RECEIVED: 'تم استلام البريف', IN_PROGRESS: 'قيد التنفيذ', INTERNAL_REVIEW: 'مراجعة داخلية',
  REVISIONS_REQUIRED: 'مطلوب تعديلات', APPROVED: 'معتمد', DELIVERED: 'تم التسليم',
};

export default async function CreativeStudio() {
  const { user, principal } = await requirePage({ permission: 'creative.view_assigned_projects' });
  const approver = can(principal, 'creative.approve_deliverables');
  // Designers only ever load projects assigned to them.
  const projects = await db.creativeProject.findMany({
    where: approver ? {} : { assigneeId: user.id },
    orderBy: { dueAt: 'asc' }, take: 100,
    select: { id: true, title: true, status: true, priority: true, dueAt: true },
  });
  return (
    <Shell principal={principal} name={user.fullName} title="الاستوديو الإبداعي">
      <div className="grid gap-4 lg:grid-cols-3">
        {FLOW.map((st) => (
          <section key={st} className="rounded-2xl border border-line bg-white p-4">
            <h2 className="mb-2 font-semibold">{LABEL[st]}</h2>
            <ul className="space-y-2 text-sm">
              {projects.filter((p) => p.status === st).map((p) => (
                <li key={p.id} className="rounded-lg bg-surface p-3">
                  <div>{p.title}</div>
                  <div className="text-brown">{p.priority}{p.dueAt ? ` · ${p.dueAt.toLocaleDateString('ar-EG')}` : ''}</div>
                </li>
              ))}
              {projects.every((p) => p.status !== st) && <li className="text-brown">—</li>}
            </ul>
          </section>
        ))}
      </div>
    </Shell>
  );
}
