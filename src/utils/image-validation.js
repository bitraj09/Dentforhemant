import sharp from 'sharp';

const MAX_BYTES = 15 * 1024 * 1024;
const MAX_PIXELS = 30_000_000;
const MAX_SIDE = 12_000;
const MIME_FORMATS = {
    'image/jpeg': ['jpeg', 'jpg'],
    'image/png': ['png'],
    'image/webp': ['webp'],
    'image/bmp': ['bmp'],
};

export async function validateImageDataUrl(value) {
    if (typeof value !== 'string' || value.length > Math.ceil(MAX_BYTES * 4 / 3) + 128) {
        return { ok: false, status: 413, reason: 'Image exceeds the upload limit.' };
    }
    const match = value.match(/^data:(image\/(?:jpeg|jpg|png|webp|bmp));base64,([A-Za-z0-9+/]+={0,2})$/i);
    if (!match) return { ok: false, reason: 'Upload a JPEG, PNG, WebP, or BMP image.' };
    const declaredMime = match[1].toLowerCase().replace('image/jpg', 'image/jpeg');
    const buffer = Buffer.from(match[2], 'base64');
    if (!buffer.length || buffer.length > MAX_BYTES) return { ok: false, status: 413, reason: 'Image exceeds the upload limit.' };
    try {
        const image = sharp(buffer, { limitInputPixels: MAX_PIXELS, failOn: 'error' });
        const metadata = await image.metadata();
        if (!MIME_FORMATS[declaredMime]?.includes(metadata.format) || !metadata.width || !metadata.height) {
            return { ok: false, reason: 'Image type does not match its content.' };
        }
        if (metadata.width > MAX_SIDE || metadata.height > MAX_SIDE || metadata.width * metadata.height > MAX_PIXELS) {
            return { ok: false, status: 413, reason: 'Image dimensions exceed the supported limit.' };
        }
        await image.stats();
        return { ok: true, buffer, mimeType: declaredMime, width: metadata.width, height: metadata.height };
    } catch {
        return { ok: false, reason: 'The uploaded image is damaged or cannot be decoded.' };
    }
}
