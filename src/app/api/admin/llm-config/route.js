import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-guard';
import { clearGeminiApiKey, getGeminiApiKeyStatus, saveGeminiApiKey } from '@/lib/llm-config';

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    return NextResponse.json(await getGeminiApiKeyStatus(), {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    console.error('[LLM config] Could not read Gemini key status.', { name: error?.name });
    return NextResponse.json({ error: 'Could not read LLM settings.' }, { status: 500 });
  }
}

export async function POST(request) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const body = await request.json();
    const apiKey = typeof body?.apiKey === 'string' ? body.apiKey.trim() : '';
    if (apiKey.length < 20 || apiKey.length > 500) {
      return NextResponse.json({ error: 'Enter a valid Gemini API key (20–500 characters).' }, { status: 400 });
    }
    await saveGeminiApiKey(apiKey);
    return NextResponse.json({ success: true, ...(await getGeminiApiKeyStatus()) });
  } catch (error) {
    console.error('[LLM config] Could not save Gemini API key.', { name: error?.name });
    return NextResponse.json({ error: 'Could not save the Gemini API key.' }, { status: 500 });
  }
}

export async function DELETE() {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    await clearGeminiApiKey();
    return NextResponse.json({ success: true, ...(await getGeminiApiKeyStatus()) });
  } catch (error) {
    console.error('[LLM config] Could not remove saved Gemini API key.', { name: error?.name });
    return NextResponse.json({ error: 'Could not remove the saved Gemini API key.' }, { status: 500 });
  }
}
