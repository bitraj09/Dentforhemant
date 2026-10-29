import { createHash, randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getVerifiedAnalyticsUser } from '@/lib/analytics-auth';
import prisma from '@/lib/prisma';

const VISITOR_COOKIE = 'dental_visitor_id';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
const VISITOR_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request) {
  const { error } = await getVerifiedAnalyticsUser();
  if (error) return error;

  try {
    const existingId = request.cookies.get(VISITOR_COOKIE)?.value;
    const visitorId = existingId && VISITOR_ID_PATTERN.test(existingId) ? existingId : randomUUID();
    const visitorHash = createHash('sha256').update(visitorId).digest('hex');
    const visitDay = new Date().toISOString().slice(0, 10);

    await prisma.siteVisitor.upsert({
      where: { visitorHash },
      create: { visitorHash },
      update: { lastSeenAt: new Date() },
    });
    await prisma.siteVisitorDailyVisit.createMany({
      data: [{ visitorHash, visitDay }],
      skipDuplicates: true,
    });

    const response = NextResponse.json({ recorded: true }, {
      headers: { 'Cache-Control': 'no-store' },
    });
    if (visitorId !== existingId) {
      response.cookies.set(VISITOR_COOKIE, visitorId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: COOKIE_MAX_AGE,
      });
    }
    return response;
  } catch (error) {
    console.error('[Site analytics] Could not record authenticated visit.', { name: error?.name });
    return NextResponse.json({ error: 'Could not record visit.' }, { status: 500 });
  }
}
