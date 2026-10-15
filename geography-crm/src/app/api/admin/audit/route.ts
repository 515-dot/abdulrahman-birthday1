import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { errorResponse, requireUser } from '@/lib/auth';

export async function GET(req: Request) {
  try {
    await requireUser({ permission: 'audit_logs.view' });
    const url = new URL(req.url);
    const page = Math.max(1, Number(url.searchParams.get('page') ?? 1));
    const action = url.searchParams.get('action') ?? undefined;
    const events = await db.auditEvent.findMany({
      where: action ? { action: { startsWith: action } } : {},
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * 50,
      take: 50,
    });
    return NextResponse.json({ page, events });
  } catch (e) {
    return errorResponse(e);
  }
}
