import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { assertSameOrigin, errorResponse, requireUser, HttpError } from '@/lib/auth';
import { canViewLead } from '@/lib/permissions';
import { AiNotConfiguredError, generate, isAiConfigured } from '@/lib/ai';
import { rateLimit } from '@/lib/rate-limit';

const Body = z.object({ leadId: z.string(), language: z.enum(['ar-EG', 'en']).default('ar-EG'), channel: z.enum(['whatsapp', 'email']).default('whatsapp') });

export async function GET() {
  try {
    await requireUser();
    return NextResponse.json({ configured: isAiConfigured() }); // lets the UI show a setup state
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const { user, principal } = await requireUser({ permission: 'leads.view_own' });
    if (!(await rateLimit(`ai:${user.id}`, 20, 60 * 60_000)).ok) throw new HttpError(429, 'AI rate limit reached');
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });

    const lead = await db.lead.findFirst({
      where: { id: parsed.data.leadId, deletedAt: null },
      include: {
        owner: { select: { teamId: true } }, stage: true,
        activities: { orderBy: { createdAt: 'desc' }, take: 5 },
      },
    });
    // Same record-level policy as the lead screens: AI can only see what the user can see.
    if (!lead || !canViewLead(principal, { ownerId: lead.ownerId, ownerTeamId: lead.owner?.teamId ?? null })) {
      throw new HttpError(404, 'Not found');
    }

    // Data minimization: first name, stage, budget and recent notes only. No phone, email or ids.
    const context = {
      firstName: lead.fullName.split(' ')[0],
      stage: lead.stage.nameEn,
      budget: lead.budget ? Number(lead.budget) : null,
      recentActivity: lead.activities.map((a) => ({ type: a.type, summary: a.summary.slice(0, 300) })),
    };
    const text = await generate({
      userId: user.id, feature: 'lead_followup',
      system: `You draft short, polite real-estate follow-up messages for a brokerage in Egypt. Write in ${parsed.data.language === 'ar-EG' ? 'Egyptian Arabic' : 'English'} for ${parsed.data.channel}. Use only the facts given; never invent prices, availability or promises. Output the message only.`,
      prompt: JSON.stringify(context),
    });
    return NextResponse.json({ draft: text, basedOn: context }); // shows the data behind the suggestion
  } catch (e) {
    if (e instanceof AiNotConfiguredError) {
      return NextResponse.json({ error: 'AI is not configured', configured: false }, { status: 503 });
    }
    return errorResponse(e);
  }
}
