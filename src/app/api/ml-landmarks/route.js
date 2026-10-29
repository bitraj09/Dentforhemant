import { NextResponse } from 'next/server';
import { requireApprovedSession } from '@/lib/auth-guard';

const ML_SERVICE_URL = (process.env.ML_SERVICE_URL || 'http://127.0.0.1:8001').replace(/\/$/, '');

/**
 * POST /api/ml-landmarks
 * Forwards the uploaded image to the FastAPI landmark service (denatlyolo.pt)
 * and returns landmarks in the polygon format used by the studio.
 */
export async function POST(req) {
    try {
        const { error: authError } = await requireApprovedSession();
        if (authError) return authError;
        const { image, imageWidth, imageHeight } = await req.json();

        if (!image) {
            return NextResponse.json({ error: 'No image provided' }, { status: 400 });
        }
        if (typeof image !== 'string' || image.length > 28_000_000) {
            return NextResponse.json({ error: 'Image is too large or invalid.' }, { status: 413 });
        }

        // Convert base64 dataURL → binary buffer → Blob
        const base64Data = image.split(',')[1];
        if (!base64Data) {
            return NextResponse.json({ error: 'Invalid image format' }, { status: 400 });
        }

        const buffer = Buffer.from(base64Data, 'base64');
        const blob = new Blob([buffer], { type: 'image/jpeg' });

        const formData = new FormData();
        formData.append('file', blob, 'image.jpg');

        // Call FastAPI landmark endpoint
        const mlRes = await fetch(`${ML_SERVICE_URL}/landmarks`, {
            method: 'POST',
            headers: { 'X-ML-API-Key': process.env.ML_API_KEY || '', 'X-Request-ID': req.headers.get('x-request-id') || '' },
            body: formData,
            signal: AbortSignal.timeout(30_000),
        });

        if (!mlRes.ok) {
            throw new Error(`ML Service returned ${mlRes.status}`);
        }

        const data = await mlRes.json();
 
        if (data.isValidXray === false) {
            return NextResponse.json({
                landmarks: [],
                annotated_image: null,
                summary: 'The uploaded image does not appear to be a valid OPG dental X-ray. Please upload a panoramic dental radiograph.',
                isValidXray: false,
                source: 'yolo',
            });
        }

        // data.landmarks already in {id, name, polygon, centerX, centerY,
        //   confidence, color, category, description, significance} format
        return NextResponse.json({
            landmarks: data.landmarks || [],
            annotated_image: data.annotated_image || null,
            summary: `Custom AI model detected ${(data.landmarks || []).length} structure(s).`,
            isValidXray: data.isValidXray !== false,
            source: 'yolo',
        });

    } catch (error) {
        console.error('[ML Landmarks API Error]', error);
        return NextResponse.json(
            { error: 'Landmark analysis is temporarily unavailable.' },
            { status: 503 }
        );
    }
}
