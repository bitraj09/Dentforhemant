import { randomUUID } from 'node:crypto';
import { lstat, mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import { basename, extname, join, resolve, sep } from 'node:path';
import sharp from 'sharp';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const legacyRoot = resolve(process.env.LEGACY_UPLOAD_DIR || join(process.cwd(), 'public', 'uploads'));
const privateRoot = resolve(process.env.PRIVATE_UPLOAD_DIR || '/data/uploads');
const typeExtensions = { jpeg: 'jpg', png: 'png', webp: 'webp' };

try {
    await mkdir(privateRoot, { recursive: true, mode: 0o700 });
    const users = await prisma.user.findMany({
        where: { idCardPath: { startsWith: '/uploads/' } },
        select: { id: true, idCardPath: true },
    });
    let migrated = 0;
    let skipped = 0;

    for (const user of users) {
        const legacyName = user.idCardPath.slice('/uploads/'.length);
        if (!legacyName || basename(legacyName) !== legacyName) { skipped++; continue; }
        const oldPath = resolve(legacyRoot, legacyName);
        if (!oldPath.startsWith(`${legacyRoot}${sep}`)) { skipped++; continue; }
        try {
            const [realRoot, realFile, info] = await Promise.all([realpath(legacyRoot), realpath(oldPath), lstat(oldPath)]);
            if (!realFile.startsWith(`${realRoot}${sep}`) || !info.isFile()) { skipped++; continue; }
            const bytes = await readFile(realFile);
            const metadata = await sharp(bytes, { limitInputPixels: 30_000_000, failOn: 'error' }).metadata();
            const extension = typeExtensions[metadata.format];
            if (!extension || !metadata.width || !metadata.height || metadata.width * metadata.height > 30_000_000) { skipped++; continue; }
            const filename = `${randomUUID()}.${extension}`;
            const newPath = join(privateRoot, filename);
            await writeFile(newPath, bytes, { flag: 'wx', mode: 0o600 });
            try {
                await prisma.user.update({ where: { id: user.id }, data: { idCardPath: `private:${filename}` } });
                migrated++;
            } catch (error) {
                const { rm } = await import('node:fs/promises');
                await rm(newPath, { force: true });
                throw error;
            }
        } catch {
            skipped++;
        }
    }
    console.log(`Verification document migration complete. Migrated: ${migrated}; skipped: ${skipped}. Legacy files were preserved.`);
} finally {
    await prisma.$disconnect();
}
