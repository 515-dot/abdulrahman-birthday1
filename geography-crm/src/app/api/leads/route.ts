import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { audit } from '@/lib/audit';
import { assertSameOrigin, clientIp, errorResponse, requireUser, HttpError } from '@/lib/auth';
import { can, leadScopeWhere } from '@/lib/permissions';

const CreateBody = z.object({
  fullName: z.string().min(2).max(120),
  phone: z.string().max(30).optional(),
  email: z.string().email().optional(),
  sourceId: z.string().optional(),
  campaignId: z.string().optional(),
  budget: z.number().nonnegative().optional(),
  notes: z.string().max(4000).optional(),
  utmSource: z.string().max(100).optional(),
  utmMedium: z.string().max(100).optional(),
  utmCampaign: z.string().max(100).optional(),
});

export async function GET(req: Request) {
  try {
    const { principal } = await requireUser();
    // The scope filter is applied in the database query, never only in the UI.
    const where = leadScopeWhere(principal);
    const url = new URL(req.url);
    const page = Math.max(1, Number(url.searchParams.get('page') ?? 1));
    const q = url.searchParams.get('q')?.trim();
    const stage = url.searchParams.get('stage');
    const filtered = {
      AND: [
        where,
        q ? { OR: [{ fullName: { contains: q, mode: 'insensitive' } }, { phone: { contains: q } }] } : {},
        stage ? { stageId: stage } : {},
      ],
    };
    const [total, leads] = await Promise.all([
      db.lead.count({ where: filtered as never }),
      db.lead.findMany({
        where: filtered as never,
        select: {
          id: true, fullName: true, phone: true, budget: true, nextFollowUpAt: true, createdAt: true,
          stage: { select: { id: true, code: true, nameAr: true, nameEn: true } },
          source: { select: { name: true } },
          owner: { select: { id: true, fullName: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * 25,
        take: 25,
      }),
    ]);
    return NextResponse.json({ total, page, leads });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const { user, principal } = await requireUser({ permission: 'leads.create' });
    const parsed = CreateBody.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });

    const first = await db.pipelineStage.findFirst({ orderBy: { position: 'asc' } });
    if (!first) throw new HttpError(500, 'Pipeline not configured');

    // New leads are owned by their creator; ownerId is never taken from the request body.
    const lead = await db.lead.create({
      data: { ...parsed.data, stageId: first.id, ownerId: user.id },
      select: { id: true },
    });
    await audit({ actorId: user.id, action: 'lead.created', targetType: 'Lead', targetId: lead.id, ip: clientIp(req) });
    void can(principal, 'leads.create');
    return NextResponse.json(lead, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
