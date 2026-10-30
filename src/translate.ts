import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { TranslationResponse, LearningRequest, LearningResult } from './types';
import { buildLearningPrompt, parseLearningResponse } from './learning.ts';

const ANTHROPIC_MODEL = 'claude-sonnet-4-6';
const GOOGLE_MODEL = 'gemini-3.1-flash-lite';
const DEEPSEEK_MODEL = 'deepseek-flash';
const DEEPSEEK_BASE_URL = 'https://api.deepseek.com';

export type Provider = 'anthropic' | 'deepseek' | 'google';

export function detectProvider(apiKey: string): Provider {
  // Order matters: Anthropic keys also start with "sk-".
  if (apiKey.startsWith('sk-ant-')) return 'anthropic';
  if (apiKey.startsWith('sk-')) return 'deepseek';
  return 'google';
}

export const PROVIDER_LABEL: Record<Provider, string> = {
  anthropic: 'Anthropic',
  deepseek: 'DeepSeek',
  google: 'Google Gemini',
};

/**
 * DeepSeek has no browser SDK worth pulling in; its API is OpenAI-shaped and
 * sends CORS headers, so plain fetch works from the page. Errors carry the
 * HTTP status so callers can tell a bad key from an empty balance.
 */
async function deepseekFetch(
  apiKey: string,
  path: string,
  init?: RequestInit,
): Promise<unknown> {
  const res = await fetch(`${DEEPSEEK_BASE_URL}/${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) {
    let detail = '';
    try {
      detail = ((await res.json()) as { error?: { message?: string } }).error?.message ?? '';
    } catch {
      // Non-JSON error body; the status code is enough.
    }
    const message =
      res.status === 402
        ? 'Your DeepSeek balance has run out. Top up at platform.deepseek.com.'
        : `DeepSeek request failed (${res.status})${detail ? `: ${detail}` : ''}`;
    throw Object.assign(new Error(message), { status: res.status });
  }

  return res.json();
}

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
 * Proves a key works before we store it. Every call is metadata-only, so
 * validating a key costs nothing in tokens.
 */
export async function validateApiKey(apiKey: string): Promise<void> {
  try {
    const provider = detectProvider(apiKey);
    if (provider === 'anthropic') {
      const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
      await client.models.list({ limit: 1 });
    } else if (provider === 'deepseek') {
      await deepseekFetch(apiKey, 'models');
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

async function translateWithAnthropic(
  request: LearningRequest,
  apiKey: string,
): Promise<LearningResult> {
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });

  const { system, user, maxTokens } = buildLearningPrompt(request);

  const message = await client.messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: maxTokens,
    system,
    messages: [{ role: 'user', content: user }],
  });

  const raw = message.content
    .filter((b) => b.type === 'text')
    .map((b) => (b as { type: 'text'; text: string }).text)
    .join('');

  return parseLearningResponse(raw, request.task);
}

async function translateWithGoogle(
  request: LearningRequest,
  apiKey: string,
): Promise<LearningResult> {
  const { system, user, maxTokens } = buildLearningPrompt(request);
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: GOOGLE_MODEL,
    systemInstruction: system,
    generationConfig: {
      responseMimeType: 'application/json',
      maxOutputTokens: maxTokens,
    },
  });

  const result = await model.generateContent(user);
  const raw = result.response.text();

  return parseLearningResponse(raw, request.task);
}

async function translateWithDeepSeek(
  request: LearningRequest,
  apiKey: string,
): Promise<LearningResult> {
  const { system, user, maxTokens } = buildLearningPrompt(request);
  const data = (await deepseekFetch(apiKey, 'chat/completions', {
    method: 'POST',
    body: JSON.stringify({
      model: DEEPSEEK_MODEL,
      max_tokens: maxTokens,
      // Thinking is on by default. Its reasoning is written to a separate
      // reasoning_content field and can use up max_tokens before any answer
      // is produced, leaving `content` empty. A short translation does not
      // need it, and turning it off is faster and cheaper.
      thinking: { type: 'disabled' },
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  })) as {
    choices?: {
      finish_reason?: string;
      message?: { content?: string | null; reasoning_content?: string | null };
    }[];
  };

  const choice = data.choices?.[0];
  const raw = choice?.message?.content ?? '';
  if (!raw.trim()) {
    if (choice?.finish_reason === 'length') {
      throw new Error(
        'DeepSeek hit its token limit before writing an answer' +
          (choice.message?.reasoning_content ? ' (it spent the limit on reasoning).' : '.'),
      );
    }
    // DeepSeek documents that JSON mode occasionally returns empty content.
    throw new Error(
      `DeepSeek returned an empty response (finish_reason: ${choice?.finish_reason ?? 'none'}). ` +
        'This happens occasionally — try again.',
    );
  }

  return parseLearningResponse(raw, request.task);
}

/**
 * Why a failure is the provider's problem rather than ours, or null if it
 * isn't. Only these are worth retrying on a backup key: a bad request or an
 * unparseable response would fail the same way elsewhere and should surface.
 */
function providerSideReason(err: unknown): string | null {
  const status = (err as { status?: number } | null)?.status;
  if (status === 402) return 'out of balance';
  if (status === 429) return 'rate limited';
  if (status === 503 || status === 529) return 'overloaded';
  if (status === 408 || status === 504) return 'timed out';
  if (status !== undefined && status >= 500) return `returning server errors (${status})`;

  const message = err instanceof Error ? err.message : String(err);
  if (/failed to fetch|networkerror|load failed|connection error/i.test(message)) {
    return 'unreachable';
  }
  return null;
}

export type LearningOutcome = {
  result: LearningResult;
  provider: Provider;
  /** Set when the primary failed and the backup answered instead. */
  fallback?: { from: Provider; reason: string };
};

/** Both tasks use the same provider fallback policy; malformed answers surface. */
export async function requestLearningWithFallback(
  request: LearningRequest,
  primaryKey: string,
  backupKey?: string | null,
): Promise<LearningOutcome> {
  const primary = detectProvider(primaryKey);
  try {
    return { result: await requestLearning(request, primaryKey), provider: primary };
  } catch (err) {
    const reason = providerSideReason(err);
    if (!backupKey || !reason) throw err;

    const backup = detectProvider(backupKey);
    try {
      return {
        result: await requestLearning(request, backupKey),
        provider: backup,
        fallback: { from: primary, reason },
      };
    } catch (backupErr) {
      const describe = (e: unknown) => (e instanceof Error ? e.message : String(e));
      throw new Error(
        `Primary (${PROVIDER_LABEL[primary]}) failed: ${describe(err)}\n\n` +
          `Backup (${PROVIDER_LABEL[backup]}) also failed: ${describe(backupErr)}`,
      );
    }
  }
}

export async function requestLearning(request: LearningRequest, apiKey: string): Promise<LearningResult> {
  switch (detectProvider(apiKey)) {
    case 'anthropic':
      return translateWithAnthropic(request, apiKey);
    case 'deepseek':
      return translateWithDeepSeek(request, apiKey);
    case 'google':
      return translateWithGoogle(request, apiKey);
  }
}

// Preserve the existing translation API for callers that only need translation.
export type TranslateOutcome = {
  response: TranslationResponse;
  provider: Provider;
  fallback?: { from: Provider; reason: string };
};

export async function translateWithFallback(
  phrase: string,
  context: string,
  primaryKey: string,
  backupKey?: string | null,
): Promise<TranslateOutcome> {
  const { result, provider, fallback } = await requestLearningWithFallback(
    { task: 'translate', phrase, context }, primaryKey, backupKey,
  );
  if (result.task !== 'translate') throw new Error('Unexpected task in translation response.');
  return { response: result.response, provider, fallback };
}

export async function translate(phrase: string, context: string, apiKey: string): Promise<TranslationResponse> {
  const result = await requestLearning({ task: 'translate', phrase, context }, apiKey);
  if (result.task !== 'translate') throw new Error('Unexpected task in translation response.');
  return result.response;
}
