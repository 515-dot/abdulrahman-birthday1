import { z } from 'zod';
import { db } from '@/lib/db';
import { aiHandlers, Lang, langLine, RULES } from '@/lib/ai-route';

const h = aiHandlers({
  feature: 'executive_summary', superAdminOnly: true,
  schema: z.object({ days: z.number().int().min(7).max(90).default(30), language: Lang }),
  build: async ({ input }) => {
    const since = new Date(Date.now() - input.days * 86_400_000);
    const [newLeads, wonDeals, openDeals, overdueTasks, activeStaff, campaigns, byStage] = await Promise.all([
      db.lead.count({ where: { createdAt: { gte: since }, deletedAt: null } }),
      db.deal.count({ where: { status: 'WON', closedAt: { gte: since } } }),
      db.deal.count({ where: { status: 'OPEN' } }),
      db.task.count({ where: { doneAt: null, dueAt: { lt: new Date() } } }),
      db.user.count({ where: { status: 'ACTIVE', deletedAt: null } }),
      db.campaign.count({ where: { OR: [{ endsAt: null }, { endsAt: { gte: new Date() } }] } }),
      db.lead.groupBy({ by: ['stageId'], where: { deletedAt: null }, _count: true }),
    ]);
    const stages = await db.pipelineStage.findMany({ select: { id: true, nameEn: true } });
    // Counts only: no names, salaries, payroll or individual records leave the database.
    const basedOn = {
      periodDays: input.days, newLeads, wonDeals, openDeals, overdueTasks, activeStaff, activeCampaigns: campaigns,
      leadsByStage: byStage.map((b) => ({ stage: stages.find((s) => s.id === b.stageId)?.nameEn, count: b._count })),
    };
    return {
      system: `You write a concise executive summary for the owner of a real-estate brokerage: headline, 3 highlights, 3 risks, 3 actions. ${langLine(input.language)} ${RULES}`,
      prompt: JSON.stringify(basedOn), basedOn,
    };
  },
});
export const GET = h.GET; export const POST = h.POST;
