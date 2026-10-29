import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
    const session = await getServerSession(authOptions);
    const userId = Number(session?.user?.id);
    if (!Number.isInteger(userId) || userId <= 0) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { email: true, status: true },
        });

        if (!user || user.email.toLowerCase() !== String(session.user.email).toLowerCase()) {
            return NextResponse.json({ error: 'Account not found' }, { status: 401 });
        }

        return NextResponse.json({ status: user.status }, {
            headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
        });
    } catch (error) {
        console.error('[Account status] Could not refresh account status.', { name: error?.name });
        return NextResponse.json({ error: 'Could not check approval status.' }, { status: 503 });
    }
}
