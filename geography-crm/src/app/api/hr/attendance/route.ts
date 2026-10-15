import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { assertSameOrigin, errorResponse, requireUser, HttpError } from '@/lib/auth';
import { parseBody } from '@/lib/api';
import { can } from '@/lib/permissions';

const Body = z.object({ action: z.enum(['in', 'out']) });

// Everyone sees and records only their own attendance; HR attendance managers can read all.
export async function GET() {
  try {
    const { user, principal } = await requireUser();
    const where = can(principal, 'hr.manage_attendance') ? {} : { userId: user.id };
    return NextResponse.json({ records: await db.attendanceRecord.findMany({ where, orderBy: { checkIn: 'desc' }, take: 200 }) });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const { user } = await requireUser();
    const { action } = await parseBody(req, Body);
    const open = await db.attendanceRecord.findFirst({ where: { userId: user.id, checkOut: null }, orderBy: { checkIn: 'desc' } });
    if (action === 'in') {
      if (open) throw new HttpError(409, 'Already checked in');
      await db.attendanceRecord.create({ data: { userId: user.id, checkIn: new Date() } });
    } else {
      if (!open) throw new HttpError(409, 'Not checked in');
      await db.attendanceRecord.update({ where: { id: open.id }, data: { checkOut: new Date() } });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
