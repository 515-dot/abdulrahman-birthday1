import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { audit } from '@/lib/audit';
import { assertSameOrigin, clientIp, errorResponse, requireUser, HttpError } from '@/lib/auth';
import { can, canViewLead } from '@/lib/permissions';

// Only these fields are editable here. ownerId changes go through /assign.
const PatchBody = z.object({
  fullName: z.string().min(2).max(120).optional(),
  phone: z.string().max(30).nullable().optional(),
  email: z.string().email().nullable().optional(),
  budget: z.number().nonnegative().nullable().optional(),
  notes: z.string().max(4000).nullable().optional(),
  stageId: z.string().optional(),
  nextFollowUpAt: z.string().datetime().nullable().optional(),
}).strict();

async function loadVisible(id: string, principal: Awaited<ReturnType<typeof requireUser>>['principal']) {
  const lead = await db.lead.findFirst({ where: { id, deletedAt: null }, include: { owner: { select: { teamId: true } } } });
  // Same 404 whether the lead does not exist or is simply not visible to this user.
  if (!lead || !canViewLead(principal, { ownerId: lead.ownerId, ownerTeamId: lead.owner?.teamId ?? null })) {
    throw new HttpError(404, 'Not found');
  }
  return lead;
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { principal } = await requireUser();
    const lead = await loadVisible((await ctx.params).id, principal);
    const full = await db.lead.findUniqueOrThrow({
      where: { id: lead.id },
      include: {
        stage: true, source: true, owner: { select: { id: true, fullName: true } },
        activities: { orderBy: { createdAt: 'desc' }, take: 100 },
      },
    });
    return NextResponse.json(full);
  } catch (e) {
    return errorResponse(e);
  }
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(req);
    const { user, principal } = await requireUser({ permission: 'leads.update' });
    const lead = await loadVisible((await ctx.params).id, principal);
    const parsed = PatchBody.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    const { nextFollowUpAt, stageId, ...rest } = parsed.data;

    if (stageId) {
      if (!(await db.pipelineStage.findUnique({ where: { id: stageId } }))) throw new HttpError(400, 'Unknown stage');
    }
    await db.lead.update({
      where: { id: lead.id },
      data: { ...rest, ...(stageId ? { stageId } : {}), ...(nextFollowUpAt !== undefined ? { nextFollowUpAt: nextFollowUpAt ? new Date(nextFollowUpAt) : null } : {}) },
    });
    await audit({
      actorId: user.id, action: 'lead.updated', targetType: 'Lead', targetId: lead.id,
      metadata: { fields: Object.keys(parsed.data) }, ip: clientIp(req),
    });
    void can(principal, 'leads.update');
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
