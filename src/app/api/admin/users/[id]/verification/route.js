import { readFile } from 'fs/promises';
import { basename, join, resolve, sep } from 'path';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth-guard';

const TYPES = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };

export async function GET(_request, { params }) {
    const { session, error } = await requireAdmin();
    if (error) return error;
    const { id } = await params;
    const userId = Number(id);
    if (!Number.isSafeInteger(userId) || userId < 1) return NextResponse.json({ error: 'Not found.' }, { status: 404 });

    try {
        const user = await prisma.user.findUnique({ where: { id: userId }, select: { idCardPath: true } });
        if (!user?.idCardPath) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
        const storageRef = user.idCardPath;
        let path;
        if (storageRef.startsWith('private:')) {
            const filename = storageRef.slice('private:'.length);
            if (basename(filename) !== filename || !/^[0-9a-f-]{36}\.(jpg|png|webp)$/i.test(filename)) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
            path = join(process.env.PRIVATE_UPLOAD_DIR || join(process.cwd(), '.private-uploads'), filename);
        } else if (storageRef.startsWith('/uploads/')) {
            const filename = basename(storageRef);
            if (!filename || filename === '.' || filename === '..') return NextResponse.json({ error: 'Not found.' }, { status: 404 });
            const legacyRoot = resolve(process.cwd(), 'public', 'uploads');
            path = resolve(legacyRoot, filename);
            if (!path.startsWith(`${legacyRoot}${sep}`)) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
        } else {
            return NextResponse.json({ error: 'Not found.' }, { status: 404 });
        }

        const data = await readFile(path);
        const extension = path.split('.').pop().toLowerCase();
        return new Response(data, { headers: {
            'Content-Type': TYPES[extension] || 'application/octet-stream',
            'Content-Disposition': 'inline',
            'Cache-Control': 'private, no-store, max-age=0',
            'X-Content-Type-Options': 'nosniff',
        } });
    } catch (error) {
        console.error('[Verification document] Unable to read document', { userId, actorId: session.user.id, error });
        return NextResponse.json({ error: 'Document is unavailable.' }, { status: 404 });
    }
}
