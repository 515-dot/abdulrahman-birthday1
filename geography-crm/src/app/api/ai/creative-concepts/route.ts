import { z } from 'zod';
import { db } from '@/lib/db';
import { HttpError } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { aiHandlers, Lang, langLine, RULES } from '@/lib/ai-route';

const h = aiHandlers({
  feature: 'creative_concepts', permission: 'creative.view_assigned_projects',
  schema: z.object({ projectId: z.string().optional(), request: z.string().min(5).max(2000), language: Lang }),
  build: async ({ user, principal, input }) => {
    let project: { title: string; brief: string | null; dueAt: Date | null } | null = null;
    if (input.projectId) {
      const p = await db.creativeProject.findUnique({ where: { id: input.projectId }, include: { brief: true } });
      const allowed = p && (can(principal, 'creative.approve_deliverables') || p.assigneeId === user.id || p.createdById === user.id);
      if (!p || !allowed) throw new HttpError(404, 'Not found');
      project = { title: p.title, brief: p.brief?.body.slice(0, 3000) ?? null, dueAt: p.dueAt };
    }
    const basedOn = { project, request: input.request };
    return {
      system: `You are a creative director for a real-estate brand (orange/brown/steel-blue palette). Propose 3 visual concepts, each with a one-line rationale and a ready-to-paste English image-generation prompt. ${langLine(input.language)} ${RULES}`,
      prompt: JSON.stringify(basedOn), basedOn,
    };
  },
});
export const GET = h.GET; export const POST = h.POST;
