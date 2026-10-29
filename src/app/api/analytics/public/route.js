import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

const PUBLIC_VIEWERS_KEY = 'PUBLIC_VIEWER_COUNT_ENABLED';

export async function GET() {
  try {
    const setting = await prisma.systemConfig.findUnique({ where: { key: PUBLIC_VIEWERS_KEY } });
    if (setting?.value !== 'true') {
      return NextResponse.json({ enabled: false }, {
        headers: { 'Cache-Control': 'no-store' },
      });
    }

    const today = new Date().toISOString().slice(0, 10);
    const viewersToday = await prisma.siteVisitorDailyVisit.count({ where: { visitDay: today } });
    return NextResponse.json({ enabled: true, viewersToday }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    console.error('[Site analytics] Could not read public viewer count.', { name: error?.name });
    return NextResponse.json({ error: 'Could not read the viewer count.' }, { status: 500 });
  }
}
