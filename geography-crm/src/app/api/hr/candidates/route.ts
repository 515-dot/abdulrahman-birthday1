import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { audit } from '@/lib/audit';
import { assertSameOrigin, clientIp, errorResponse, requireUser, HttpError } from '@/lib/auth';
import { parseBody } from '@/lib/api';

const STAGES = ['APPLIED', 'SCREENING', 'INTERVIEW', 'OFFER', 'HIRED', 'REJECTED'] as const;
const Create = z.object({
  fullName: z.string().min(2).max(160), position: z.string().min(2).max(160),
  email: z.string().email().max(254).optional(), phone: z.string().max(40).optional(), notes: z.string().max(4000).optional(),
});
const Update = z.object({ id: z.string(), stage: z.enum(STAGES).optional(), notes: z.string().max(4000).optional() });

export async function GET() {
  try {
    await requireUser({ permission: 'hr.manage_recruitment' });
    const candidates = await db.candidate.findMany({ orderBy: { createdAt: 'desc' }, take: 300 });
    return NextResponse.json({ candidates });
  } catch (e) { return errorResponse(e); }
}

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const { user } = await requireUser({ permission: 'hr.manage_recruitment' });
    const input = await parseBody(req, Create);
    const c = await db.candidate.create({ data: { ...input, createdById: user.id }, select: { id: true } });
    await audit({ actorId: user.id, action: 'candidate.created', targetType: 'Candidate', targetId: c.id, ip: clientIp(req) });
    return NextResponse.json(c, { status: 201 });
  } catch (e) { return errorResponse(e); }
}

export async function PATCH(req: Request) {
  try {
    assertSameOrigin(req);
    const { user } = await requireUser({ permission: 'hr.manage_recruitment' });
    const { id, ...data } = await parseBody(req, Update);
    const existing = await db.candidate.findUnique({ where: { id }, select: { stage: true } });
    if (!existing) throw new HttpError(404, 'Not found');
    await db.candidate.update({ where: { id }, data });
    await audit({ actorId: user.id, action: 'candidate.updated', targetType: 'Candidate', targetId: id, metadata: { from: existing.stage, to: data.stage ?? existing.stage }, ip: clientIp(req) });
    return NextResponse.json({ ok: true });
  } catch (e) { return errorResponse(e); }
}
