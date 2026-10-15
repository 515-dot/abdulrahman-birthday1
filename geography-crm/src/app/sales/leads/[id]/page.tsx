import { notFound } from 'next/navigation';
import Shell from '@/components/Shell';
import LeadActions from '@/components/LeadActions';
import { db } from '@/lib/db';
import { requirePage } from '@/lib/guard';
import { canViewLead, can } from '@/lib/permissions';

export default async function LeadPage({ params }: { params: Promise<{ id: string }> }) {
  const { user, principal } = await requirePage({ permission: 'leads.view_own' });
  const { id } = await params;
  const lead = await db.lead.findFirst({
    where: { id, deletedAt: null },
    include: {
      stage: true, source: true, owner: { select: { fullName: true, teamId: true } },
      activities: { orderBy: { createdAt: 'desc' }, take: 100 },
    },
  });
  // Same record-level rule as the API; a hidden lead behaves exactly like a missing one.
  if (!lead || !canViewLead(principal, { ownerId: lead.ownerId, ownerTeamId: lead.owner?.teamId ?? null })) notFound();
  const stages = await db.pipelineStage.findMany({ orderBy: { position: 'asc' } });
  const label: Record<string, string> = { CALL: 'مكالمة', MEETING: 'اجتماع', WHATSAPP: 'واتساب', EMAIL: 'بريد', NOTE: 'ملاحظة', FOLLOW_UP: 'متابعة' };

  return (
    <Shell principal={principal} name={user.fullName} title={lead.fullName}>
      <div className="grid gap-6 lg:grid-cols-3">
        <section className="space-y-2 rounded-2xl border border-line bg-white p-5 text-sm">
          <div><span className="text-brown">الهاتف: </span><span dir="ltr">{lead.phone ?? '—'}</span></div>
          <div><span className="text-brown">البريد: </span><span dir="ltr">{lead.email ?? '—'}</span></div>
          <div><span className="text-brown">الميزانية: </span>{lead.budget ? Number(lead.budget).toLocaleString('ar-EG') : '—'}</div>
          <div><span className="text-brown">المصدر: </span>{lead.source?.name ?? '—'}</div>
          <div><span className="text-brown">المسؤول: </span>{lead.owner?.fullName ?? '—'}</div>
          {lead.notes && <p className="border-t border-line pt-2">{lead.notes}</p>}
        </section>
        <section className="space-y-4 lg:col-span-2">
          {can(principal, 'leads.update') && (
            <LeadActions leadId={lead.id} stageId={lead.stageId} stages={stages.map((s) => ({ id: s.id, label: s.nameAr }))} />
          )}
          <div className="rounded-2xl border border-line bg-white p-5">
            <h2 className="mb-3 font-semibold">سجل النشاط</h2>
            <ul className="space-y-3 text-sm">
              {lead.activities.map((a) => (
                <li key={a.id} className="border-s-2 border-brand ps-3">
                  <div className="text-brown">{label[a.type]} · {a.createdAt.toLocaleString('ar-EG')}</div>
                  <div>{a.summary}</div>
                </li>
              ))}
              {lead.activities.length === 0 && <li className="text-brown">لا توجد أنشطة بعد.</li>}
            </ul>
          </div>
        </section>
      </div>
    </Shell>
  );
}
