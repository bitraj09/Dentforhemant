import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';
import prisma from '@/lib/prisma';

const GEMINI_KEY_CONFIG = 'llm.gemini.apiKey';
const ENCRYPTED_PREFIX = 'encrypted:v1:';

function getEncryptionKey() {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error('NEXTAUTH_SECRET must be configured to store an LLM API key.');
  return scryptSync(secret, 'dental-ai-gemini-api-key-v1', 32);
}

function encryptApiKey(apiKey) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(apiKey, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${ENCRYPTED_PREFIX}${iv.toString('base64url')}:${tag.toString('base64url')}:${ciphertext.toString('base64url')}`;
}

function decryptApiKey(value) {
  if (!value.startsWith(ENCRYPTED_PREFIX)) throw new Error('Stored Gemini API key has an unsupported format.');
  const [ivText, tagText, ciphertextText] = value.slice(ENCRYPTED_PREFIX.length).split(':');
  if (!ivText || !tagText || !ciphertextText) throw new Error('Stored Gemini API key is incomplete.');
  const decipher = createDecipheriv('aes-256-gcm', getEncryptionKey(), Buffer.from(ivText, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagText, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextText, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}

export async function getGeminiApiKey() {
  try {
    const config = await prisma.systemConfig.findUnique({ where: { key: GEMINI_KEY_CONFIG } });
    if (config?.value) return decryptApiKey(config.value);
  } catch (error) {
    console.error('[LLM config] Could not read the saved Gemini API key.', { name: error?.name });
  }
  return process.env.GEMINI_API_KEY || '';
}

export async function getGeminiApiKeyStatus() {
  const config = await prisma.systemConfig.findUnique({ where: { key: GEMINI_KEY_CONFIG } });
  return {
    isConfigured: Boolean(config?.value || process.env.GEMINI_API_KEY),
    source: config?.value ? 'admin' : process.env.GEMINI_API_KEY ? 'environment' : 'none',
  };
}

export async function saveGeminiApiKey(apiKey) {
  const encryptedValue = encryptApiKey(apiKey);
  await prisma.systemConfig.upsert({
    where: { key: GEMINI_KEY_CONFIG },
    update: { value: encryptedValue },
    create: { key: GEMINI_KEY_CONFIG, value: encryptedValue },
  });
}

export async function clearGeminiApiKey() {
  await prisma.systemConfig.deleteMany({ where: { key: GEMINI_KEY_CONFIG } });
}
