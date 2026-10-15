import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { audit } from '@/lib/audit';
import { assertSameOrigin, clientIp, errorResponse, requireUser, HttpError } from '@/lib/auth';
import { canViewLead } from '@/lib/permissions';

const Body = z.object({
  type: z.enum(['CALL', 'MEETING', 'WHATSAPP', 'EMAIL', 'NOTE', 'FOLLOW_UP']),
  summary: z.string().min(1).max(4000),
  dueAt: z.string().datetime().optional(),
});

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(req);
    const { user, principal } = await requireUser({ permission: 'leads.update' });
    const { id } = await ctx.params;
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });

    const lead = await db.lead.findFirst({ where: { id, deletedAt: null }, include: { owner: { select: { teamId: true } } } });
    if (!lead || !canViewLead(principal, { ownerId: lead.ownerId, ownerTeamId: lead.owner?.teamId ?? null })) {
      throw new HttpError(404, 'Not found');
    }
    const due = parsed.data.dueAt ? new Date(parsed.data.dueAt) : undefined;
    const activity = await db.activity.create({
      data: { leadId: id, type: parsed.data.type, summary: parsed.data.summary, dueAt: due, byUserId: user.id },
      select: { id: true },
    });
    if (parsed.data.type === 'FOLLOW_UP' && due) {
      await db.lead.update({ where: { id }, data: { nextFollowUpAt: due } });
    }
    await audit({ actorId: user.id, action: 'lead.activity_added', targetType: 'Lead', targetId: id, ip: clientIp(req) });
    return NextResponse.json(activity, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
