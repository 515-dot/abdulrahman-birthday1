import { z } from 'zod';
import { db } from '@/lib/db';
import { HttpError } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { aiHandlers, Lang, langLine, RULES } from '@/lib/ai-route';

const h = aiHandlers({
  feature: 'campaign_analysis', permission: 'marketing.view_campaigns',
  schema: z.object({ campaignId: z.string(), language: Lang }),
  build: async ({ principal, input }) => {
    const c = await db.campaign.findUnique({ where: { id: input.campaignId }, include: { expenses: true } });
    if (!c) throw new HttpError(404, 'Not found');
    // Aggregates only: marketing never receives individual lead records through this path.
    const [total, byStage, won] = await Promise.all([
      db.lead.count({ where: { campaignId: c.id, deletedAt: null } }),
      db.lead.groupBy({ by: ['stageId'], where: { campaignId: c.id, deletedAt: null }, _count: true }),
      db.lead.count({ where: { campaignId: c.id, deletedAt: null, stage: { code: 'won' } } }),
    ]);
    const stages = await db.pipelineStage.findMany({ where: { id: { in: byStage.map((b) => b.stageId) } }, select: { id: true, nameEn: true } });
    const money = can(principal, 'marketing.manage_budgets');
    const spend = c.expenses.reduce((s, e) => s + Number(e.amount), 0);
    const basedOn = {
      campaign: c.name, channel: c.channel, startsAt: c.startsAt, endsAt: c.endsAt,
      leads: total, wonDeals: won, conversionRate: total ? won / total : null,
      leadsByStage: byStage.map((b) => ({ stage: stages.find((s) => s.id === b.stageId)?.nameEn, count: b._count })),
      ...(money ? { budget: c.budget ? Number(c.budget) : null, spend, costPerLead: total ? spend / total : null } : { financials: 'not available to this user' }),
    };
    return {
      system: `You analyze a real-estate ad campaign for a marketing manager. Give 3 findings and 3 recommendations grounded in the numbers. State when the sample is too small to conclude. ${langLine(input.language)} ${RULES}`,
      prompt: JSON.stringify(basedOn), basedOn,
    };
  },
});
export const GET = h.GET; export const POST = h.POST;
