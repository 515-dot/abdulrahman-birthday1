import { NextResponse } from 'next/server';
import { destroySession } from '@/lib/session';
import { assertSameOrigin, errorResponse } from '@/lib/auth';

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    await destroySession();
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
