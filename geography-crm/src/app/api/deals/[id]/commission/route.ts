import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { audit } from '@/lib/audit';
import { assertSameOrigin, clientIp, errorResponse, requireUser, HttpError } from '@/lib/auth';

const Body = z.object({ ratePct: z.number().min(0).max(100) });

// Commission changes are financial records: permission-gated and always audited.
export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(req);
    const { user } = await requireUser({ permission: 'sales.view_commissions' });
    const { id } = await ctx.params;
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });

    const deal = await db.deal.findUnique({ where: { id } });
    if (!deal) throw new HttpError(404, 'Not found');
    if (deal.status !== 'WON') throw new HttpError(400, 'Commission applies to won deals only');

    const amount = (Number(deal.value) * parsed.data.ratePct) / 100;
    const before = await db.commission.findUnique({ where: { dealId: id } });
    await db.commission.upsert({
      where: { dealId: id },
      update: { ratePct: parsed.data.ratePct, amount },
      create: { dealId: id, userId: deal.ownerId, ratePct: parsed.data.ratePct, amount },
    });
    await audit({
      actorId: user.id, action: 'commission.set', targetType: 'Deal', targetId: id,
      metadata: { previousRate: before ? Number(before.ratePct) : null, newRate: parsed.data.ratePct }, ip: clientIp(req),
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
