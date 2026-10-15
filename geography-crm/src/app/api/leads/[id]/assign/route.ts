import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { audit } from '@/lib/audit';
import { assertSameOrigin, clientIp, errorResponse, requireUser, HttpError } from '@/lib/auth';
import { can, canViewLead } from '@/lib/permissions';

const Body = z.object({ toUserId: z.string().min(1) });

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(req);
    const { user, principal } = await requireUser({ permission: 'leads.assign' });
    const { id } = await ctx.params;
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });

    const lead = await db.lead.findFirst({ where: { id, deletedAt: null }, include: { owner: { select: { teamId: true } } } });
    if (!lead || !canViewLead(principal, { ownerId: lead.ownerId, ownerTeamId: lead.owner?.teamId ?? null })) {
      throw new HttpError(404, 'Not found');
    }
    const target = await db.user.findFirst({
      where: { id: parsed.data.toUserId, status: 'ACTIVE', deletedAt: null, department: { code: 'SALES' } },
    });
    if (!target) throw new HttpError(400, 'Target must be an active sales employee');
    // Without company-wide access, leads can only be handed to people in the actor's own team.
    if (!can(principal, 'leads.view_all') && target.teamId !== principal.teamId) {
      throw new HttpError(403, 'Target is outside your team');
    }

    await db.$transaction([
      db.lead.update({ where: { id }, data: { ownerId: target.id } }),
      db.leadAssignment.create({ data: { leadId: id, fromUserId: lead.ownerId, toUserId: target.id, byUserId: user.id } }),
    ]);
    await audit({
      actorId: user.id, action: 'lead.assigned', targetType: 'Lead', targetId: id,
      metadata: { from: lead.ownerId, to: target.id }, ip: clientIp(req),
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
