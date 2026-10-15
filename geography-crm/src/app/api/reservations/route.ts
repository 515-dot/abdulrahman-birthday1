import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { audit } from '@/lib/audit';
import { assertSameOrigin, clientIp, errorResponse, requireUser, HttpError } from '@/lib/auth';
import { parseBody } from '@/lib/api';
import { can } from '@/lib/permissions';

const Body = z.object({ propertyId: z.string(), clientId: z.string().optional(), amount: z.number().nonnegative().optional() });

export async function GET() {
  try {
    const { user, principal } = await requireUser({ permission: 'leads.view_own' });
    const reservations = await db.reservation.findMany({
      where: can(principal, 'leads.view_all') ? {} : { ownerId: user.id },
      select: { id: true, amount: true, createdAt: true, property: { select: { id: true, title: true } } },
      orderBy: { createdAt: 'desc' }, take: 100,
    });
    return NextResponse.json({ reservations });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const { user } = await requireUser({ permission: 'leads.update' });
    const d = await parseBody(req, Body);
    // Atomic: only an AVAILABLE property can be reserved, so two agents cannot double-book it.
    const result = await db.$transaction(async (tx) => {
      const claimed = await tx.property.updateMany({
        where: { id: d.propertyId, status: 'AVAILABLE', deletedAt: null }, data: { status: 'RESERVED' },
      });
      if (claimed.count !== 1) return null;
      return tx.reservation.create({
        data: { propertyId: d.propertyId, clientId: d.clientId, amount: d.amount, ownerId: user.id }, select: { id: true },
      });
    });
    if (!result) throw new HttpError(409, 'Property is not available');
    await audit({ actorId: user.id, action: 'reservation.created', targetType: 'Property', targetId: d.propertyId, ip: clientIp(req) });
    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
