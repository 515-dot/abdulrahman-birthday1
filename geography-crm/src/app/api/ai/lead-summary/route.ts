import { z } from 'zod';
import { db } from '@/lib/db';
import { HttpError } from '@/lib/auth';
import { canViewLead } from '@/lib/permissions';
import { aiHandlers, Lang, langLine, RULES } from '@/lib/ai-route';

const h = aiHandlers({
  feature: 'lead_summary', permission: 'leads.view_own',
  schema: z.object({ leadId: z.string(), language: Lang }),
  build: async ({ principal, input }) => {
    const lead = await db.lead.findFirst({
      where: { id: input.leadId, deletedAt: null },
      include: { owner: { select: { teamId: true } }, stage: true, source: true, activities: { orderBy: { createdAt: 'desc' }, take: 10 } },
    });
    if (!lead || !canViewLead(principal, { ownerId: lead.ownerId, ownerTeamId: lead.owner?.teamId ?? null })) throw new HttpError(404, 'Not found');
    const basedOn = {
      firstName: lead.fullName.split(' ')[0], stage: lead.stage.nameEn, source: lead.source?.name ?? null,
      budget: lead.budget ? Number(lead.budget) : null, notes: lead.notes?.slice(0, 600) ?? null,
      nextFollowUpAt: lead.nextFollowUpAt, createdAt: lead.createdAt,
      activities: lead.activities.map((a) => ({ type: a.type, summary: a.summary.slice(0, 300), at: a.createdAt })),
    };
    return {
      system: `You assist a real-estate sales agent. Summarize the lead in 3-4 lines, then list up to 3 concrete next steps. ${langLine(input.language)} ${RULES}`,
      prompt: JSON.stringify(basedOn), basedOn,
    };
  },
});
export const GET = h.GET; export const POST = h.POST;
