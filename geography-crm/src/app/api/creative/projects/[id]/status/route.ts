import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { audit } from '@/lib/audit';
import { assertSameOrigin, clientIp, errorResponse, requireUser, HttpError } from '@/lib/auth';
import { parseBody } from '@/lib/api';
import { can } from '@/lib/permissions';

const Body = z.object({
  status: z.enum(['IN_PROGRESS', 'INTERNAL_REVIEW', 'REVISIONS_REQUIRED', 'APPROVED', 'DELIVERED']),
  comment: z.string().max(2000).optional(),
});

// Workflow: Brief Received → In Progress → Internal Review → (Revisions Required ↔ In Progress) → Approved → Delivered
const DESIGNER_MOVES: Record<string, string[]> = {
  BRIEF_RECEIVED: ['IN_PROGRESS'], IN_PROGRESS: ['INTERNAL_REVIEW'], REVISIONS_REQUIRED: ['IN_PROGRESS'],
};
const APPROVER_MOVES: Record<string, string[]> = {
  INTERNAL_REVIEW: ['APPROVED', 'REVISIONS_REQUIRED'], APPROVED: ['DELIVERED'],
};

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(req);
    const { user, principal } = await requireUser();
    const { id } = await ctx.params;
    const d = await parseBody(req, Body);
    const approver = can(principal, 'creative.approve_deliverables');

    const project = await db.creativeProject.findUnique({ where: { id } });
    // Hidden projects look nonexistent: designers only know about projects assigned to them.
    if (!project || (!approver && project.assigneeId !== user.id)) throw new HttpError(404, 'Not found');

    const allowed = [
      ...(project.assigneeId === user.id && can(principal, 'creative.view_assigned_projects') ? DESIGNER_MOVES[project.status] ?? [] : []),
      ...(approver ? APPROVER_MOVES[project.status] ?? [] : []),
    ];
    if (!allowed.includes(d.status)) throw new HttpError(403, 'This status change is not allowed');

    const isDecision = project.status === 'INTERNAL_REVIEW' && (d.status === 'APPROVED' || d.status === 'REVISIONS_REQUIRED');
    await db.$transaction([
      db.creativeProject.update({ where: { id }, data: { status: d.status } }),
      ...(isDecision
        ? [db.approvalRequest.create({
            data: { projectId: id, requestedById: project.assigneeId ?? user.id, decidedById: user.id, decision: d.status, comment: d.comment, decidedAt: new Date() },
          })]
        : []),
    ]);
    await audit({ actorId: user.id, action: 'creative.status_changed', targetType: 'CreativeProject', targetId: id, metadata: { from: project.status, to: d.status }, ip: clientIp(req) });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
