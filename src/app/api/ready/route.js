import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';
const ML_SERVICE_URL = (process.env.ML_SERVICE_URL || 'http://127.0.0.1:8001').replace(/\/$/, '');

export async function GET() {
    try {
        await prisma.$queryRaw`SELECT 1`;
        const mlResponse = await fetch(`${ML_SERVICE_URL}/`, {
            cache: 'no-store',
            signal: AbortSignal.timeout(3000),
        });
        if (!mlResponse.ok) throw new Error(`ML service is not ready (${mlResponse.status}).`);
        return NextResponse.json({ ready: true }, {
            headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
        });
    } catch {
        return NextResponse.json({ ready: false }, {
            status: 503,
            headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
        });
    }
}
