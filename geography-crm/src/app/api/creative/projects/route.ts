import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { audit } from '@/lib/audit';
import { assertSameOrigin, clientIp, errorResponse, requireUser, HttpError } from '@/lib/auth';
import { can } from '@/lib/permissions';

const CreateBody = z.object({
  title: z.string().min(2).max(160),
  brief: z.string().min(1).max(8000),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH']).default('NORMAL'),
  dueAt: z.string().datetime().optional(),
  assigneeId: z.string().optional(),
  campaignId: z.string().optional(),
});

// Designers see only projects assigned to them. Approvers see all.
export async function GET() {
  try {
    const { user, principal } = await requireUser();
    const approver = can(principal, 'creative.approve_deliverables');
    if (!approver && !can(principal, 'creative.view_assigned_projects')) throw new HttpError(403, 'Forbidden');
    const projects = await db.creativeProject.findMany({
      where: approver ? {} : { assigneeId: user.id },
      select: { id: true, title: true, status: true, priority: true, dueAt: true, assigneeId: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return NextResponse.json({ projects });
  } catch (e) {
    return errorResponse(e);
  }
}

// Marketing can send a brief to a designer without gaining access to the rest of the studio.
export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const { user } = await requireUser({ permission: 'marketing.view_campaigns' });
    const parsed = CreateBody.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    const d = parsed.data;
    if (d.assigneeId && !(await db.user.findFirst({ where: { id: d.assigneeId, status: 'ACTIVE', department: { code: 'CREATIVE' } } }))) {
      throw new HttpError(400, 'Assignee must be an active creative team member');
    }
    const p = await db.creativeProject.create({
      data: {
        title: d.title, priority: d.priority, dueAt: d.dueAt ? new Date(d.dueAt) : undefined,
        assigneeId: d.assigneeId, createdById: user.id,
        brief: { create: { body: d.brief, campaignId: d.campaignId } },
      },
      select: { id: true },
    });
    await audit({ actorId: user.id, action: 'creative.project_created', targetType: 'CreativeProject', targetId: p.id, ip: clientIp(req) });
    return NextResponse.json(p, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
