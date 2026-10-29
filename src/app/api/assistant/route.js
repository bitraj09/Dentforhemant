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
  if (!messages.length || messages[messages.length - 1]?.role !== 'user') {
    return NextResponse.json({ error: 'Enter a question to continue.' }, { status: 400 });
  }

  if (messages.some((message) => !['user', 'assistant'].includes(message?.role) || typeof message?.content !== 'string' || message.content.length > 2500)) {
    return NextResponse.json({ error: 'One of the messages is invalid or too long.' }, { status: 400 });
  }

  try {
    const response = await fetch(`${ML_SERVICE_URL}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-ML-API-Key': process.env.ML_API_KEY || '' },
      body: JSON.stringify({ messages, context }),
      signal: AbortSignal.timeout(300_000),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return NextResponse.json({ error: data.error || 'Local assistant service could not answer.' }, { status: response.status });
    return NextResponse.json({ reply: data.reply });
  } catch (error) {
    console.error('[Dental assistant] Local ML request failed.', { name: error?.name });
    return NextResponse.json({ error: error?.name === 'TimeoutError' ? 'The local assistant took too long to respond. Try again.' : 'Could not reach the local assistant service. Check that the ML backend is running.' }, { status: error?.name === 'TimeoutError' ? 504 : 503 });
  }
}
