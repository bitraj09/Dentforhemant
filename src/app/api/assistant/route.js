import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';
import rateLimit from '@/lib/rate-limit';
import { getGeminiApiKey } from '@/lib/llm-config';

const limiter = rateLimit({ interval: 60_000, uniqueTokenPerInterval: 1000 });
const GEMINI_FLASH_MODELS = ['gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.5-flash'];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableGeminiError(error) {
  return [408, 429, 500, 502, 503, 504].includes(Number(error?.status));
}

async function generateGeminiReply(apiKey, prompt, imagePart) {
  let lastError;
  for (const [modelIndex, modelId] of GEMINI_FLASH_MODELS.entries()) {
    const gemini = new GoogleGenerativeAI(apiKey).getGenerativeModel({
      model: modelId,
      generationConfig: { temperature: 0.3, maxOutputTokens: 900 },
    });

    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const result = await gemini.generateContent(imagePart ? [prompt, imagePart] : prompt);
        const reply = result.response.text()?.trim();
        if (!reply) throw new Error('Empty assistant response');
        return reply;
      } catch (error) {
        lastError = error;
        if (!isRetryableGeminiError(error)) throw error;

        const isLastAttempt = attempt === 1;
        const canTryAnotherModel = modelIndex < GEMINI_FLASH_MODELS.length - 1;
        if (isLastAttempt && !canTryAnotherModel) throw error;
        if (!isLastAttempt) {
          await sleep(700 * (2 ** attempt) + Math.floor(Math.random() * 400));
        }
      }
    }
  }
  throw lastError || new Error('Gemini did not return a response.');
}

export async function POST(request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Please sign in to use the assistant.' }, { status: 401 });
  }
  if (session.user.status !== 'APPROVED') return NextResponse.json({ error: 'Account approval is required.' }, { status: 403 });

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

  const messages = Array.isArray(body?.messages) ? body.messages.slice(-12) : [];
  const context = typeof body?.context === 'string' ? body.context.trim().slice(0, 2500) : '';
  const image = typeof body?.image === 'string' ? body.image : '';
  if (!messages.length || messages[messages.length - 1]?.role !== 'user') {
    return NextResponse.json({ error: 'Enter a question to continue.' }, { status: 400 });
  }

  if (messages.some((message) => !['user', 'assistant'].includes(message?.role) || typeof message?.content !== 'string' || message.content.length > 2500)) {
    return NextResponse.json({ error: 'One of the messages is invalid or too long.' }, { status: 400 });
  }

  const apiKey = await getGeminiApiKey();
  if (!apiKey) {
    return NextResponse.json({ error: 'Gemini AI is not configured. Ask an administrator to add the Gemini API key.' }, { status: 503 });
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
    const reply = await generateGeminiReply(apiKey, prompt, imagePart);
    return NextResponse.json({ reply });
  } catch (error) {
    console.error('[Dental assistant] Gemini request failed.', { name: error?.name, status: error?.status, message: error?.message?.slice(0, 250) });
    const status = Number(error?.status);
    if (status === 401 || status === 403) {
      return NextResponse.json({ error: 'Gemini rejected the API key. Ask an administrator to check the key and its API access.' }, { status: 502 });
    }
    if (status === 429) {
      return NextResponse.json({ error: 'Gemini request quota is temporarily exhausted. Please wait and try again.' }, { status: 503 });
    }
    if (status === 503 || status === 502 || status === 504) {
      return NextResponse.json({ error: 'Gemini is at capacity right now. Please try again shortly.' }, { status: 503 });
    }
    return NextResponse.json({ error: 'Gemini could not answer right now. Please try again.' }, { status: 502 });
  }
}
