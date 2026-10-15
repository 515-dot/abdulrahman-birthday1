import { NextResponse } from 'next/server';
import { errorResponse, requireUser } from '@/lib/auth';
import { getCompanyStats } from '@/lib/stats';

export async function GET() {
  try {
    await requireUser({ permission: 'leads.view_all' });
    return NextResponse.json(await getCompanyStats());
  } catch (e) {
    return errorResponse(e);
  }
}
