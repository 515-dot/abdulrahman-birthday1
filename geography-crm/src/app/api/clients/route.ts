import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { audit } from '@/lib/audit';
import { assertSameOrigin, clientIp, errorResponse, requireUser } from '@/lib/auth';
import { parseBody } from '@/lib/api';
import { can } from '@/lib/permissions';

const Body = z.object({
  fullName: z.string().min(2).max(120),
  phone: z.string().max(30).optional(),
  email: z.string().email().optional(),
  budgetMin: z.number().nonnegative().optional(),
  budgetMax: z.number().nonnegative().optional(),
  preferredLocations: z.array(z.string().max(80)).max(20).default([]),
  preferredTypes: z.array(z.string().max(80)).max(20).default([]),
  notes: z.string().max(4000).optional(),
});

// Clients are private to their owner unless the user can view all leads.
export async function GET() {
  try {
    const { user, principal } = await requireUser({ permission: 'leads.view_own' });
    const where = can(principal, 'leads.view_all') ? { deletedAt: null } : { deletedAt: null, ownerId: user.id };
    const clients = await db.client.findMany({ where, orderBy: { createdAt: 'desc' }, take: 100 });
    return NextResponse.json({ clients });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const { user } = await requireUser({ permission: 'leads.create' });
    const data = await parseBody(req, Body);
    const c = await db.client.create({ data: { ...data, ownerId: user.id }, select: { id: true } });
    await audit({ actorId: user.id, action: 'client.created', targetType: 'Client', targetId: c.id, ip: clientIp(req) });
    return NextResponse.json(c, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
