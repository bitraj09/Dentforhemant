import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';
import rateLimit from '@/lib/rate-limit';

const limiter = rateLimit({ interval: 60_000, uniqueTokenPerInterval: 1000 });
const ML_SERVICE_URL = (process.env.ML_SERVICE_URL || 'http://127.0.0.1:8001').replace(/\/$/, '');

export async function POST(request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Please sign in to use the assistant.' }, { status: 401 });
  }

  const { success } = await limiter.check(12, String(session.user.id));
  if (!success) {
    return NextResponse.json({ error: 'You have sent several questions recently. Please wait a minute and try again.' }, { status: 429 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'The message could not be read.' }, { status: 400 });
  }

  const model = body?.model === 'pall' ? 'pall' : 'gemini';
  const messages = Array.isArray(body?.messages) ? body.messages.slice(-12) : [];
  const context = typeof body?.context === 'string' ? body.context.trim().slice(0, 2500) : '';
  const image = typeof body?.image === 'string' ? body.image : '';
  if (!messages.length || messages[messages.length - 1]?.role !== 'user') {
    return NextResponse.json({ error: 'Enter a question to continue.' }, { status: 400 });
  }

  if (messages.some((message) => !['user', 'assistant'].includes(message?.role) || typeof message?.content !== 'string' || message.content.length > 2500)) {
    return NextResponse.json({ error: 'One of the messages is invalid or too long.' }, { status: 400 });
  }

  if (image && model === 'pall') {
    return NextResponse.json({ error: 'This assistant uses a text-only model. Remove the scan attachment and try again.' }, { status: 400 });
  }

  if (model === 'gemini') {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Gemini is not configured. Add GEMINI_API_KEY to the project root .env file and restart the app.' }, { status: 503 });
    }

    let imagePart;
    if (image) {
      if (image.length > 7_000_000) {
        return NextResponse.json({ error: 'The attached image is too large. Choose a smaller image and try again.' }, { status: 413 });
      }
      const match = image.match(/^data:image\/(png|jpe?g|webp);base64,([A-Za-z0-9+/]+={0,2})$/i);
      if (!match) {
        return NextResponse.json({ error: 'The attached file must be a PNG, JPEG, or WebP image.' }, { status: 400 });
      }
      const extension = match[1].toLowerCase();
      imagePart = { inlineData: { mimeType: `image/${extension === 'jpg' ? 'jpeg' : extension}`, data: match[2] } };
    }

    const systemPrompt = `You are Dental AI Assistant, an educational assistant for dental students, clinicians, and researchers. Explain dental anatomy, radiographic interpretation, common pathologies, and learning material in clear, measured language. Do not claim to diagnose a patient or replace examination by a qualified dental professional. If a user asks for a diagnosis, explain relevant possibilities and encourage professional review. Be explicit about uncertainty and do not invent details that were not provided.`;
    const transcript = messages.map((message) => `${message.role === 'user' ? 'User' : 'Assistant'}: ${message.content}`).join('\n\n');
    const prompt = [
      systemPrompt,
      context ? `User-provided case or study context (treat as unverified):\n${context}` : '',
      imagePart ? 'The user attached a dental image. Discuss it for educational purposes, describe uncertainty, and do not present a definitive diagnosis.' : '',
      `Conversation:\n${transcript}`,
      'Reply to the latest user message.',
    ].filter(Boolean).join('\n\n');

    try {
      const client = new GoogleGenerativeAI(apiKey);
      const gemini = client.getGenerativeModel({
        model: 'gemini-3.8-flash',
        generationConfig: { temperature: 0.3, maxOutputTokens: 900 },
      });
      const result = await gemini.generateContent(imagePart ? [prompt, imagePart] : prompt);
      const reply = result.response.text()?.trim();
      if (!reply) throw new Error('Empty assistant response');
      return NextResponse.json({ reply });
    } catch (error) {
      console.error('[Dental assistant] Gemini request failed:', error?.message || error);
      return NextResponse.json({ error: 'Gemini could not answer right now. Please try again.' }, { status: 502 });
    }
  }

  try {
    const response = await fetch(`${ML_SERVICE_URL}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, context }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return NextResponse.json(
        { error: data.error || 'The assistant is temporarily unavailable. Please try again later.' },
        { status: response.status >= 500 ? 503 : response.status },
      );
    }
    return NextResponse.json({ reply: data.reply });
  } catch (error) {
    console.error('[Dental assistant] ML service request failed:', error?.message || error);
    return NextResponse.json({ error: 'The dental assistant model is unavailable. Please try again later.' }, { status: 503 });
  }
}
