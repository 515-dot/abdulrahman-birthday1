import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { audit } from '@/lib/audit';
import { assertSameOrigin, clientIp, errorResponse, requireUser } from '@/lib/auth';
import { parseBody } from '@/lib/api';

const Body = z.object({
  title: z.string().min(2).max(160),
  price: z.number().positive().optional(),
  areaSqm: z.number().positive().optional(),
  bedrooms: z.number().int().min(0).max(30).optional(),
  typeName: z.string().max(80).optional(),
  locationName: z.string().max(120).optional(),
  projectName: z.string().max(160).optional(),
  developerName: z.string().max(160).optional(),
});

export async function GET(req: Request) {
  try {
    await requireUser({ permission: 'leads.view_own' });
    const status = new URL(req.url).searchParams.get('status') ?? undefined;
    const properties = await db.property.findMany({
      where: { deletedAt: null, ...(status ? { status } : {}) },
      select: {
        id: true, title: true, price: true, areaSqm: true, bedrooms: true, status: true,
        type: { select: { name: true } }, location: { select: { name: true } },
        project: { select: { name: true, developer: { select: { name: true } } } },
      },
      orderBy: { createdAt: 'desc' }, take: 200,
    });
    return NextResponse.json({ properties });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const { user } = await requireUser({ permission: 'properties.manage' });
    const d = await parseBody(req, Body);

    const type = d.typeName ? await db.propertyType.upsert({ where: { name: d.typeName }, update: {}, create: { name: d.typeName } }) : null;
    const location = d.locationName
      ? (await db.location.findFirst({ where: { name: d.locationName } })) ?? (await db.location.create({ data: { name: d.locationName } }))
      : null;
    const developer = d.developerName ? await db.developer.upsert({ where: { name: d.developerName }, update: {}, create: { name: d.developerName } }) : null;
    const project = d.projectName
      ? (await db.project.findFirst({ where: { name: d.projectName } })) ??
        (await db.project.create({ data: { name: d.projectName, developerId: developer?.id, locationId: location?.id } }))
      : null;

    const p = await db.property.create({
      data: {
        title: d.title, price: d.price, areaSqm: d.areaSqm, bedrooms: d.bedrooms,
        typeId: type?.id, locationId: location?.id, projectId: project?.id,
      },
      select: { id: true },
    });
    await audit({ actorId: user.id, action: 'property.created', targetType: 'Property', targetId: p.id, ip: clientIp(req) });
    return NextResponse.json(p, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
