import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireApprovedSession } from '@/lib/auth-guard';

export async function POST(req) {
    try {
        const { session, error } = await requireApprovedSession();
        if (error) return error;

        const data = await req.json();
        const { type, patientName, findings, summary, imageThumbnail } = data;

        if (!type || !findings || !summary) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const userId = parseInt(session.user.id);

        const record = await prisma.record.create({
            data: {
                type,
                patientName: patientName || 'Unknown Patient',
                findings,
                summary,
                imageThumbnail,
                userId,
            },
        });

        return NextResponse.json({ message: 'Record saved successfully', record });
    } catch (error) {
        console.error('[Records API Error]', { name: error?.name, code: error?.code });
        return NextResponse.json({ error: 'An internal server error occurred.' }, { status: 500 });
    }
}

export async function GET() {
    try {
        const { session, error } = await requireApprovedSession();
        if (error) return error;

        const records = await prisma.record.findMany({
            where: { userId: parseInt(session.user.id) },
            orderBy: { createdAt: 'desc' },
        });

        return NextResponse.json({ records }, {
            headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
        });
    } catch (error) {
        console.error('[Records GET API Error]', { name: error?.name, code: error?.code });
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function DELETE(req) {
    try {
        const { session, error } = await requireApprovedSession();
        if (error) return error;

        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'Record ID is required' }, { status: 400 });
        }

        const userId = parseInt(session.user.id);

        // Verify the record belongs to the user
        const record = await prisma.record.findFirst({
            where: { id: parseInt(id), userId },
        });

        if (!record) {
            return NextResponse.json({ error: 'Record not found or unauthorized' }, { status: 404 });
        }

        await prisma.record.delete({
            where: { id: parseInt(id) },
        });

        return NextResponse.json({ message: 'Record deleted successfully' });
    } catch (error) {
        console.error('[Records DELETE API Error]', { name: error?.name, code: error?.code });
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
