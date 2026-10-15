import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { audit } from '@/lib/audit';
import { assertSameOrigin, clientIp, errorResponse, requireUser, HttpError } from '@/lib/auth';
import { can, canViewLead } from '@/lib/permissions';

const CreateBody = z.object({
  leadId: z.string().min(1),
  propertyId: z.string().optional(),
  value: z.number().positive(),
});

export async function GET() {
  try {
    const { user, principal } = await requireUser({ permission: 'leads.view_own' });
    const all = can(principal, 'leads.view_all');
    const showCommission = can(principal, 'sales.view_commissions');
    const deals = await db.deal.findMany({
      where: all ? {} : { ownerId: user.id },
      select: {
        id: true, value: true, status: true, closedAt: true, createdAt: true,
        lead: { select: { id: true, fullName: true } },
        property: { select: { id: true, title: true } },
        // Commission amounts are only selected when the user holds the permission.
        ...(showCommission ? { commission: { select: { ratePct: true, amount: true, paidAt: true } } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return NextResponse.json({ deals });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const { user, principal } = await requireUser({ permission: 'leads.update' });
    const parsed = CreateBody.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });

    const lead = await db.lead.findFirst({ where: { id: parsed.data.leadId, deletedAt: null }, include: { owner: { select: { teamId: true } } } });
    if (!lead || !canViewLead(principal, { ownerId: lead.ownerId, ownerTeamId: lead.owner?.teamId ?? null })) {
      throw new HttpError(404, 'Not found');
    }
    const deal = await db.deal.create({
      data: { leadId: lead.id, clientId: lead.clientId, propertyId: parsed.data.propertyId, value: parsed.data.value, ownerId: user.id },
      select: { id: true },
    });
    await audit({ actorId: user.id, action: 'deal.created', targetType: 'Deal', targetId: deal.id, ip: clientIp(req) });
    return NextResponse.json(deal, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
