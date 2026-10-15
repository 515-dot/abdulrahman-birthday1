import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { assertSameOrigin, errorResponse, requireUser, HttpError } from '@/lib/auth';
import { parseBody } from '@/lib/api';

const Body = z.object({ done: z.boolean() });

// Only the assignee or the creator may change a task.
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(req);
    const { user } = await requireUser();
    const { id } = await ctx.params;
    const { done } = await parseBody(req, Body);
    const task = await db.task.findUnique({ where: { id }, select: { assigneeId: true, createdById: true } });
    if (!task || (task.assigneeId !== user.id && task.createdById !== user.id)) throw new HttpError(404, 'Not found');
    await db.task.update({ where: { id }, data: { doneAt: done ? new Date() : null } });
    return NextResponse.json({ ok: true });
  } catch (e) { return errorResponse(e); }
}
