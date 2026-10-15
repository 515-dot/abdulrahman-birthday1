import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { audit } from '@/lib/audit';
import { assertSameOrigin, clientIp, errorResponse, requireUser } from '@/lib/auth';
import { can } from '@/lib/permissions';

const CreateBody = z.object({
  name: z.string().min(2).max(160),
  channel: z.enum(['facebook', 'instagram', 'tiktok', 'google_ads', 'other']),
  budget: z.number().nonnegative().optional(),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
});

export async function GET() {
  try {
    const { principal } = await requireUser({ permission: 'marketing.view_campaigns' });
    const budgets = can(principal, 'marketing.manage_budgets'); // budget/spend hidden otherwise
    const rows = await db.campaign.findMany({
      select: {
        id: true, name: true, channel: true, startsAt: true, endsAt: true,
        ...(budgets ? { budget: true, expenses: { select: { amount: true } } } : {}),
        _count: { select: { leads: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return NextResponse.json({ campaigns: rows });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const { user, principal } = await requireUser({ permission: 'marketing.view_campaigns' });
    const parsed = CreateBody.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    const { budget, startsAt, endsAt, ...rest } = parsed.data;
    const c = await db.campaign.create({
      data: {
        ...rest, ownerId: user.id,
        startsAt: startsAt ? new Date(startsAt) : undefined, endsAt: endsAt ? new Date(endsAt) : undefined,
        budget: can(principal, 'marketing.manage_budgets') ? budget : undefined, // silently ignored without permission
      },
      select: { id: true },
    });
    await audit({ actorId: user.id, action: 'campaign.created', targetType: 'Campaign', targetId: c.id, ip: clientIp(req) });
    return NextResponse.json(c, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
