import { z } from 'zod';
import { db } from '@/lib/db';
import { HttpError } from '@/lib/auth';
import { canViewLead } from '@/lib/permissions';
import { aiHandlers, Lang, langLine, RULES } from '@/lib/ai-route';

const h = aiHandlers({
  feature: 'property_match', permission: 'leads.view_own',
  schema: z.object({ leadId: z.string(), requirements: z.string().max(1000).optional(), language: Lang }),
  build: async ({ principal, input }) => {
    const lead = await db.lead.findFirst({ where: { id: input.leadId, deletedAt: null }, include: { owner: { select: { teamId: true } } } });
    if (!lead || !canViewLead(principal, { ownerId: lead.ownerId, ownerTeamId: lead.owner?.teamId ?? null })) throw new HttpError(404, 'Not found');
    const budget = lead.budget ? Number(lead.budget) : null;
    // Candidates are filtered in the database; the model only ranks and explains them.
    const props = await db.property.findMany({
      where: { deletedAt: null, status: 'AVAILABLE', ...(budget ? { price: { lte: budget * 1.15 } } : {}) },
      select: { id: true, title: true, price: true, areaSqm: true, bedrooms: true, type: { select: { name: true } }, location: { select: { name: true } }, project: { select: { name: true } } },
      orderBy: { price: 'desc' }, take: 15,
    });
    if (!props.length) throw new HttpError(404, 'No available properties match this budget');
    const basedOn = {
      budget, requirements: input.requirements ?? null,
      candidates: props.map((p) => ({ id: p.id, title: p.title, price: p.price ? Number(p.price) : null, areaSqm: p.areaSqm ? Number(p.areaSqm) : null, bedrooms: p.bedrooms, type: p.type?.name, location: p.location?.name, project: p.project?.name })),
    };
    return {
      system: `You recommend properties to a sales agent. Pick the best 3 from "candidates" only (cite title and id) and explain each in one line against the budget and requirements. ${langLine(input.language)} ${RULES}`,
      prompt: JSON.stringify(basedOn), basedOn,
    };
  },
});
export const GET = h.GET; export const POST = h.POST;
