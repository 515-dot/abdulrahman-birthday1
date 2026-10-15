import { db } from './db';

// Every figure is a real query. Empty tables yield zeros / empty arrays, never invented numbers.
export async function getCompanyStats() {
  const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
  const live = { deletedAt: null };
  const [totalLeads, newToday, followUpsDue, headcount, pendingLeave, byStage, bySource, won, awaitingApproval] = await Promise.all([
    db.lead.count({ where: live }),
    db.lead.count({ where: { ...live, createdAt: { gte: startOfDay } } }),
    db.lead.count({ where: { ...live, nextFollowUpAt: { lte: new Date() } } }),
    db.user.count({ where: { status: 'ACTIVE', deletedAt: null } }),
    db.leaveRequest.count({ where: { status: 'PENDING' } }),
    db.pipelineStage.findMany({
      orderBy: { position: 'asc' },
      select: { nameAr: true, nameEn: true, _count: { select: { leads: { where: live } } } },
    }),
    db.leadSource.findMany({ select: { name: true, _count: { select: { leads: { where: live } } } } }),
    db.deal.aggregate({ where: { status: 'WON' }, _sum: { value: true }, _count: true }),
    db.creativeProject.count({ where: { status: 'INTERNAL_REVIEW' } }),
  ]);
  return {
    totalLeads, newToday, followUpsDue, headcount, pendingLeave, awaitingApproval,
    closedDeals: won._count, revenue: Number(won._sum.value ?? 0),
    pipeline: byStage.map((s) => ({ label: s.nameAr, count: s._count.leads })),
    sources: bySource.map((s) => ({ label: s.name, count: s._count.leads })),
  };
}
