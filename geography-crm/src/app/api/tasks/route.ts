import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { audit } from '@/lib/audit';
import { assertSameOrigin, clientIp, errorResponse, requireUser, HttpError } from '@/lib/auth';
import { parseBody } from '@/lib/api';
import { can, canViewLead } from '@/lib/permissions';

const Body = z.object({
  title: z.string().min(2).max(200),
  dueAt: z.string().datetime().optional(),
  leadId: z.string().optional(),
  assigneeId: z.string().optional(),
});

// Default: my own tasks. ?scope=team needs leads.view_team and returns only my team's tasks.
export async function GET(req: Request) {
  try {
    const { user, principal } = await requireUser();
    const scope = new URL(req.url).searchParams.get('scope');
    let where: Record<string, unknown> = { assigneeId: user.id };
    if (scope === 'team') {
      if (!can(principal, 'leads.view_team') || !principal.teamId) throw new HttpError(403, 'Forbidden');
      where = { assignee: { teamId: principal.teamId } };
    }
    const tasks = await db.task.findMany({
      where, orderBy: [{ doneAt: 'asc' }, { dueAt: 'asc' }], take: 200,
      select: { id: true, title: true, dueAt: true, doneAt: true, leadId: true, assigneeId: true, createdAt: true },
    });
    return NextResponse.json({ tasks });
  } catch (e) { return errorResponse(e); }
}

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const { user, principal } = await requireUser();
    const input = await parseBody(req, Body);

    if (input.leadId) {
      const lead = await db.lead.findFirst({ where: { id: input.leadId, deletedAt: null }, include: { owner: { select: { teamId: true } } } });
      if (!lead || !canViewLead(principal, { ownerId: lead.ownerId, ownerTeamId: lead.owner?.teamId ?? null })) throw new HttpError(404, 'Not found');
    }

    let assigneeId = user.id;
    if (input.assigneeId && input.assigneeId !== user.id) {
      if (!can(principal, 'leads.assign')) throw new HttpError(403, 'Forbidden');
      const target = await db.user.findFirst({ where: { id: input.assigneeId, status: 'ACTIVE', deletedAt: null }, select: { id: true, teamId: true } });
      const sameTeam = !!principal.teamId && target?.teamId === principal.teamId;
      if (!target || !(can(principal, 'leads.view_all') || sameTeam)) throw new HttpError(400, 'Invalid assignee');
      assigneeId = target.id;
    }

    const task = await db.task.create({
      data: { title: input.title, dueAt: input.dueAt ? new Date(input.dueAt) : null, leadId: input.leadId, assigneeId, createdById: user.id },
      select: { id: true },
    });
    if (assigneeId !== user.id) {
      // Generic text only: no lead names or amounts in notifications.
      await db.notification.create({ data: { userId: assigneeId, title: 'تم تعيين مهمة جديدة لك' } });
    }
    await audit({ actorId: user.id, action: 'task.created', targetType: 'Task', targetId: task.id, ip: clientIp(req) });
    return NextResponse.json(task, { status: 201 });
  } catch (e) { return errorResponse(e); }
}
