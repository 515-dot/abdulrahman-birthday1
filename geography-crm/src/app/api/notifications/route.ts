import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { assertSameOrigin, errorResponse, requireUser } from '@/lib/auth';
import { parseBody } from '@/lib/api';

const Body = z.object({ ids: z.array(z.string()).max(100).optional() }); // omitted = mark all read

// Every user reads and updates only their own notifications.
export async function GET() {
  try {
    const { user } = await requireUser();
    const [items, unread] = await Promise.all([
      db.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' }, take: 50, select: { id: true, title: true, body: true, readAt: true, createdAt: true } }),
      db.notification.count({ where: { userId: user.id, readAt: null } }),
    ]);
    return NextResponse.json({ notifications: items, unread });
  } catch (e) { return errorResponse(e); }
}

export async function PATCH(req: Request) {
  try {
    assertSameOrigin(req);
    const { user } = await requireUser();
    const { ids } = await parseBody(req, Body);
    await db.notification.updateMany({ where: { userId: user.id, readAt: null, ...(ids ? { id: { in: ids } } : {}) }, data: { readAt: new Date() } });
    return NextResponse.json({ ok: true });
  } catch (e) { return errorResponse(e); }
}
