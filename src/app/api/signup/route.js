import { NextResponse } from 'next/server';
import { writeFile, mkdir, rm } from 'fs/promises';
import { join } from 'path';
import { randomUUID } from 'crypto';
import prisma from '@/lib/prisma';
import bcrypt from 'bcrypt';
import { validateImageDataUrl } from '@/utils/image-validation';

export async function POST(req) {
    try {
        const formData = await req.formData();
        const name = formData.get('name');
        const email = formData.get('email');
        const password = formData.get('password');
        const confirmPassword = formData.get('confirmPassword');
        const collegeName = formData.get('collegeName');
        const collegeYear = formData.get('collegeYear');
        const collegeIdNumber = formData.get('collegeIdNumber');
        const idCard = formData.get('idCard'); // This is a File object

        if (typeof name !== 'string' || typeof email !== 'string' || typeof password !== 'string' || !name.trim() || !email.trim() || !password ||
            (collegeName != null && typeof collegeName !== 'string') || (collegeYear != null && typeof collegeYear !== 'string') ||
            (collegeIdNumber != null && typeof collegeIdNumber !== 'string')) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Email format validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const normalizedEmail = email.trim().toLowerCase();
        if (!emailRegex.test(normalizedEmail)) {
            return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
        }

        // Password strength validation
        if (password.length < 8) {
            return NextResponse.json({ error: 'Password must be at least 8 characters long' }, { status: 400 });
        }

        if (password !== confirmPassword) {
            return NextResponse.json({ error: 'Passwords do not match' }, { status: 400 });
        }

        if (!idCard || idCard.size === 0) {
            return NextResponse.json({ error: 'College ID card is required' }, { status: 400 });
        }

        // Check if user exists before processing file upload
        const existingUser = await prisma.user.findUnique({
            where: { email: normalizedEmail }
        });

        if (existingUser) {
            return NextResponse.json({ error: 'An account with this email already exists.' }, { status: 409 });
        }

        // Check for blocked college types
        const blockedConfig = await prisma.systemConfig.findUnique({ where: { key: 'BLOCKED_COLLEGES' } });
        if (blockedConfig && blockedConfig.value) {
            const blockedList = blockedConfig.value.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
            const lowerClg = (collegeName || '').toLowerCase();
            const isBlocked = blockedList.some(block => lowerClg.includes(block));
            if (isBlocked) {
                return NextResponse.json({ error: 'Signups from this type of college are currently blocked by the Super Admin.' }, { status: 403 });
            }
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Validate file type and size
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
        if (!allowedTypes.includes(idCard.type)) {
            return NextResponse.json({ error: 'Invalid file type. Please upload a JPG, PNG, or WebP image.' }, { status: 400 });
        }

        if (idCard.size > 5 * 1024 * 1024) { // 5MB limit
            return NextResponse.json({ error: 'File size too large. Max limit is 5MB.' }, { status: 400 });
        }

        // Verification documents are stored privately; filenames come from the server only.
        let idCardPath = null;
        let storedPath = null;
        if (idCard && idCard.size > 0) {
            const bytes = await idCard.arrayBuffer();
            const buffer = Buffer.from(bytes);
            const checked = await validateImageDataUrl(`data:${idCard.type};base64,${buffer.toString('base64')}`);
            if (!checked.ok || !['image/jpeg', 'image/png', 'image/webp'].includes(idCard.type)) {
                return NextResponse.json({ error: checked.reason || 'The uploaded image content is invalid.' }, { status: checked.status || 400 });
            }
            const uploadDir = process.env.PRIVATE_UPLOAD_DIR || join(process.cwd(), '.private-uploads');
            await mkdir(uploadDir, { recursive: true, mode: 0o700 });
            const storageId = randomUUID();
            const extension = idCard.type === 'image/jpeg' ? 'jpg' : idCard.type === 'image/png' ? 'png' : 'webp';
            storedPath = join(uploadDir, `${storageId}.${extension}`);
            await writeFile(storedPath, buffer, { flag: 'wx', mode: 0o600 });
            idCardPath = `private:${storageId}.${extension}`;
        }

        let user;
        try {
            user = await prisma.user.create({
                data: {
                    name: name.trim(),
                    email: normalizedEmail,
                    password: hashedPassword,
                    collegeName: collegeName || '',
                    collegeYear: collegeYear || '',
                    collegeIdNumber: collegeIdNumber || '',
                    idCardPath,
                    role: 'USER',
                    status: 'PENDING',
                }
            });
        } catch (error) {
            if (storedPath) {
                try {
                    await rm(storedPath, { force: true });
                } catch (cleanupError) {
                    console.error('[Signup Upload Cleanup Error]', { name: cleanupError?.name });
                }
            }
            if (error?.code === 'P2002') {
                return NextResponse.json({ error: 'An account with this email already exists.' }, { status: 409 });
            }
            throw error;
        }

        return NextResponse.json({ message: 'User created successfully', user: { id: user.id, email: user.email } });
    } catch (error) {
        console.error('[Signup API Error]', { name: error?.name, code: error?.code, message: error?.code ? 'Database operation failed.' : 'Request processing failed.' });
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
