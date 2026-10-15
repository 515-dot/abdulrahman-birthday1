import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { audit } from '@/lib/audit';
import { assertSameOrigin, clientIp, errorResponse, requireUser, HttpError } from '@/lib/auth';
import { can } from '@/lib/permissions';

const CreateBody = z.object({
  startsOn: z.string().date(),
  endsOn: z.string().date(),
  reason: z.string().max(1000).optional(),
});
const DecideBody = z.object({ id: z.string(), status: z.enum(['APPROVED', 'REJECTED']) });

// Every employee sees only their own requests; HR attendance managers see all.
export async function GET() {
  try {
    const { user, principal } = await requireUser();
    const where = can(principal, 'hr.manage_attendance') ? {} : { userId: user.id };
    return NextResponse.json({ requests: await db.leaveRequest.findMany({ where, orderBy: { createdAt: 'desc' }, take: 200 }) });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const { user } = await requireUser();
    const parsed = CreateBody.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    const startsOn = new Date(parsed.data.startsOn), endsOn = new Date(parsed.data.endsOn);
    if (endsOn < startsOn) throw new HttpError(400, 'End date is before start date');
    const r = await db.leaveRequest.create({ data: { userId: user.id, startsOn, endsOn, reason: parsed.data.reason }, select: { id: true } });
    return NextResponse.json(r, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function PATCH(req: Request) {
  try {
    assertSameOrigin(req);
    const { user } = await requireUser({ permission: 'hr.manage_attendance' });
    const parsed = DecideBody.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    const lr = await db.leaveRequest.findUnique({ where: { id: parsed.data.id } });
    if (!lr || lr.status !== 'PENDING') throw new HttpError(404, 'Not found');
    if (lr.userId === user.id) throw new HttpError(403, 'You cannot decide your own request');
    await db.leaveRequest.update({ where: { id: lr.id }, data: { status: parsed.data.status, decidedById: user.id } });
    await db.notification.create({
      // Notification text is deliberately generic: no personal or salary data.
      data: { userId: lr.userId, title: parsed.data.status === 'APPROVED' ? 'تمت الموافقة على طلب الإجازة' : 'تم رفض طلب الإجازة' },
    });
    await audit({ actorId: user.id, action: `leave.${parsed.data.status.toLowerCase()}`, targetType: 'LeaveRequest', targetId: lr.id, ip: clientIp(req) });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
