import { NextResponse } from 'next/server';
import { getVerifiedAnalyticsUser, requireVerifiedAnalyticsAdmin } from '@/lib/analytics-auth';
import prisma from '@/lib/prisma';

const PUBLIC_VIEWERS_KEY = 'PUBLIC_VIEWER_COUNT_ENABLED';

async function readPublicSetting() {
  const setting = await prisma.systemConfig.findUnique({ where: { key: PUBLIC_VIEWERS_KEY } });
  return setting?.value === 'true';
}

export async function GET() {
  const { user, error } = await getVerifiedAnalyticsUser();
  if (error) return error;
  const adminError = requireVerifiedAnalyticsAdmin(user);
  if (adminError) return adminError;

  try {
    const today = new Date().toISOString().slice(0, 10);
    const [totalUniqueVisitors, visitorsToday, publicDisplayEnabled] = await Promise.all([
      prisma.siteVisitor.count(),
      prisma.siteVisitorDailyVisit.count({ where: { visitDay: today } }),
      readPublicSetting(),
    ]);

    return NextResponse.json({ totalUniqueVisitors, visitorsToday, publicDisplayEnabled }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    console.error('[Site analytics] Could not read visitor statistics.', { name: error?.name });
    return NextResponse.json({ error: 'Could not read visitor statistics.' }, { status: 500 });
  }
}

export async function POST(request) {
  const { user, error } = await getVerifiedAnalyticsUser();
  if (error) return error;
  const adminError = requireVerifiedAnalyticsAdmin(user);
  if (adminError) return adminError;

  try {
    const body = await request.json();
    if (typeof body?.publicDisplayEnabled !== 'boolean') {
      return NextResponse.json({ error: 'Choose whether to show the count publicly.' }, { status: 400 });
    }

    await prisma.systemConfig.upsert({
      where: { key: PUBLIC_VIEWERS_KEY },
      create: { key: PUBLIC_VIEWERS_KEY, value: String(body.publicDisplayEnabled) },
      update: { value: String(body.publicDisplayEnabled) },
    });

    return NextResponse.json({ publicDisplayEnabled: body.publicDisplayEnabled }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    console.error('[Site analytics] Could not update public display setting.', { name: error?.name });
    return NextResponse.json({ error: 'Could not update the viewer-count setting.' }, { status: 500 });
  }
}
