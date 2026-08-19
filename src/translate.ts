import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { TranslationResponse } from './types';

const SYSTEM_PROMPT = `You are a Japanese language tutor. The user will give you an English phrase they want to express in Japanese, plus optional context (e.g. register, audience, formality).

Return exactly 3 translation options as a JSON object — no markdown, no commentary, just the raw JSON.

Schema:
{
  "options": [
    {
      "kanji": "<Japanese text with kanji where natural>",
      "reading": "<full hiragana reading>",
      "romaji": "<Hepburn romaji, lowercase>",
      "register": "<one of: formal | casual | written | honorific | humble | polite>",
      "nuance": "<1-2 sentences explaining when to use this vs. the others>"
    }
  ]
}

Vary the 3 options meaningfully in register or nuance — do not return near-duplicates.`;

const ANTHROPIC_MODEL = 'claude-sonnet-4-6';
const GOOGLE_MODEL = 'gemini-3.1-flash-lite';

export type Provider = 'anthropic' | 'google';

export function detectProvider(apiKey: string): Provider {
  if (apiKey.startsWith('sk-ant-')) return 'anthropic';
  return 'google';
}

export const PROVIDER_LABEL: Record<Provider, string> = {
  anthropic: 'Anthropic',
  google: 'Google Gemini',
};

function describeKeyError(err: unknown): string {
  const status = (err as { status?: number } | null)?.status;
  const raw = err instanceof Error ? err.message : String(err);

  if (status === 401 || status === 403 || /api[\s_-]?key|unauthor|permission denied/i.test(raw)) {
    return 'That key was rejected. Check you copied the whole key, with no trailing spaces.';
  }
  if (/failed to fetch|networkerror|load failed/i.test(raw)) {
    return 'Could not reach the provider. Check your connection and try again.';
  }
  return raw;
}

/**
 * Proves a key works before we store it. Both calls are metadata-only, so
 * validating a key costs nothing in tokens.
 */
export async function validateApiKey(apiKey: string): Promise<void> {
  try {
    if (detectProvider(apiKey) === 'anthropic') {
      const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
      await client.models.list({ limit: 1 });
    } else {
      const genAI = new GoogleGenerativeAI(apiKey);
      await genAI.getGenerativeModel({ model: GOOGLE_MODEL }).countTokens('ok');
    }
  } catch (err) {
    // A 429 means the request authenticated and then hit a quota — the key
    // itself is good, which is all we are checking for here.
    if ((err as { status?: number } | null)?.status === 429) return;
    throw new Error(describeKeyError(err));
  }
}

function stripFences(raw: string): string {
  return raw
    .replace(/^```(?:json)?\n?/m, '')
    .replace(/\n?```$/m, '')
    .trim();
}

function parseAndValidate(raw: string): TranslationResponse {
  const cleaned = stripFences(raw);

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(
      `JSON parse failed.\n\nRaw response:\n${raw}\n\nCleaned:\n${cleaned}`,
    );
  }

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !Array.isArray((parsed as { options?: unknown }).options)
  ) {
    throw new Error(
      `Unexpected response shape — missing "options" array.\n\nParsed:\n${JSON.stringify(parsed, null, 2)}`,
    );
  }

  return parsed as TranslationResponse;
}

async function translateWithAnthropic(
  phrase: string,
  context: string,
  apiKey: string,
): Promise<TranslationResponse> {
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });

  const userContent = context.trim()
    ? `Phrase: ${phrase}\nContext: ${context}`
    : `Phrase: ${phrase}`;

  const message = await client.messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userContent }],
  });

  const raw = message.content
    .filter((b) => b.type === 'text')
    .map((b) => (b as { type: 'text'; text: string }).text)
    .join('');

  return parseAndValidate(raw);
}

async function translateWithGoogle(
  phrase: string,
  context: string,
  apiKey: string,
): Promise<TranslationResponse> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: GOOGLE_MODEL,
    systemInstruction: SYSTEM_PROMPT,
    generationConfig: {
      responseMimeType: 'application/json',
    },
  });

  const userContent = context.trim()
    ? `Phrase: ${phrase}\nContext: ${context}`
    : `Phrase: ${phrase}`;

  const result = await model.generateContent(userContent);
  const raw = result.response.text();

  return parseAndValidate(raw);
}

export async function translate(
  phrase: string,
  context: string,
  apiKey: string,
): Promise<TranslationResponse> {
  const provider = detectProvider(apiKey);
  if (provider === 'google') {
    return translateWithGoogle(phrase, context, apiKey);
  }
  return translateWithAnthropic(phrase, context, apiKey);
}
