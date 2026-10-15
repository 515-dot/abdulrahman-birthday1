import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { audit } from '@/lib/audit';
import { assertSameOrigin, clientIp, errorResponse, requireUser, HttpError } from '@/lib/auth';
import { parseBody } from '@/lib/api';
import { can } from '@/lib/permissions';

const Body = z.object({
  userId: z.string(), period: z.string().regex(/^\d{4}-(Q[1-4]|H[12]|FY)$/),
  rating: z.number().int().min(1).max(5), comments: z.string().max(4000).optional(),
});

// Employees see only their own reviews; HR performance managers see all.
export async function GET() {
  try {
    const { user, principal } = await requireUser();
    const where = can(principal, 'hr.manage_performance') ? {} : { userId: user.id };
    const reviews = await db.performanceReview.findMany({ where, orderBy: { createdAt: 'desc' }, take: 300, select: { id: true, userId: true, period: true, rating: true, comments: true, createdAt: true } });
    return NextResponse.json({ reviews });
  } catch (e) { return errorResponse(e); }
}

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const { user } = await requireUser({ permission: 'hr.manage_performance' });
    const input = await parseBody(req, Body);
    if (input.userId === user.id) throw new HttpError(403, 'Cannot review yourself');
    const subject = await db.user.findFirst({ where: { id: input.userId, deletedAt: null }, select: { id: true } });
    if (!subject) throw new HttpError(404, 'Not found');
    const dup = await db.performanceReview.findUnique({ where: { userId_period: { userId: input.userId, period: input.period } }, select: { id: true } });
    if (dup) throw new HttpError(409, 'A review for this period already exists');
    const r = await db.performanceReview.create({ data: { ...input, reviewerId: user.id }, select: { id: true } });
    await db.notification.create({ data: { userId: input.userId, title: 'تمت إضافة تقييم أداء جديد' } }); // no rating in the text
    await audit({ actorId: user.id, action: 'review.created', targetType: 'PerformanceReview', targetId: r.id, ip: clientIp(req) });
    return NextResponse.json(r, { status: 201 });
  } catch (e) { return errorResponse(e); }
}
