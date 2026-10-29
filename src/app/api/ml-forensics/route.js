import { NextResponse } from 'next/server';
import { requireApprovedSession } from '@/lib/auth-guard';

const ML_SERVICE_URL = (process.env.ML_SERVICE_URL || 'http://127.0.0.1:8001').replace(/\/$/, '');

export async function POST(req) {
    try {
        const { error: authError } = await requireApprovedSession();
        if (authError) return authError;
        const { image } = await req.json();

        if (!image) {
            return NextResponse.json({ error: 'No image provided' }, { status: 400 });
        }
        if (typeof image !== 'string' || image.length > 28_000_000) {
            return NextResponse.json({ error: 'Image is too large or invalid.' }, { status: 413 });
        }

        // Convert base64 dataUrl to Blob
        const base64Data = image.split(',')[1];
        if (!base64Data) {
            return NextResponse.json({ error: 'Invalid image format' }, { status: 400 });
        }
        const buffer = Buffer.from(base64Data, 'base64');
        const blob = new Blob([buffer], { type: 'image/jpeg' });

        const formData = new FormData();
        formData.append('file', blob, 'image.jpg');

        // Call FastAPI Python ML service /forensics
        const mlRes = await fetch(`${ML_SERVICE_URL}/forensics`, {
            method: 'POST',
            headers: { 'X-ML-API-Key': process.env.ML_API_KEY || '', 'X-Request-ID': req.headers.get('x-request-id') || '' },
            body: formData,
            signal: AbortSignal.timeout(60_000),
        });

        if (!mlRes.ok) {
            if (mlRes.status === 422) {
                const failure = await mlRes.json().catch(() => ({}));
                return NextResponse.json({ error: failure.error || 'The forensic model could not produce an estimate from this image.' }, { status: 422 });
            }
            throw new Error(`ML Service returned ${mlRes.status}`);
        }

        const data = await mlRes.json();

        if (data.isValidXray === false) {
            return NextResponse.json({
                result: null,
                summary: data.summary || 'The uploaded image does not appear to be a valid OPG dental X-ray. Please upload a panoramic dental radiograph.',
                isValidXray: false,
                source: 'ml_pipeline',
            });
        }

        return NextResponse.json({
            result: {
                estimatedAge: data.estimatedAge,
                minAge: data.minAge,
                maxAge: data.maxAge,
                confidence: data.confidence,
                parameters: data.parameters || [],
                full_visualization: data.full_visualization,
                target_teeth: data.target_teeth || {},
                detected_count: data.detected_count || 0,
            },
            summary: data.summary,
            isValidXray: true,
            source: 'ml_pipeline',
        });

    } catch (error) {
        console.error('ML Forensics API Error:', error);
        console.error('[ML Forensics API Error]', error);
        return NextResponse.json({ error: 'Forensic analysis is temporarily unavailable.' }, { status: 503 });
    }
}
