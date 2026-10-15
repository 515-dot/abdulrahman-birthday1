import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { audit } from '@/lib/audit';
import { assertSameOrigin, clientIp, errorResponse, requireUser } from '@/lib/auth';
import { parseBody } from '@/lib/api';

const Body = z.object({
  platform: z.enum(['facebook', 'instagram', 'tiktok', 'google_ads', 'other']),
  caption: z.string().max(4000).optional(),
  publishAt: z.string().datetime().optional(),
  campaignId: z.string().optional(),
});

export async function GET() {
  try {
    await requireUser({ permission: 'marketing.view_campaigns' });
    const entries = await db.contentEntry.findMany({ orderBy: { publishAt: 'asc' }, take: 200 });
    return NextResponse.json({ entries });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const { user } = await requireUser({ permission: 'marketing.view_campaigns' });
    const d = await parseBody(req, Body);
    const e = await db.contentEntry.create({
      data: { platform: d.platform, caption: d.caption, campaignId: d.campaignId, publishAt: d.publishAt ? new Date(d.publishAt) : undefined },
      select: { id: true },
    });
    await audit({ actorId: user.id, action: 'content.created', targetType: 'ContentEntry', targetId: e.id, ip: clientIp(req) });
    return NextResponse.json(e, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
