import type { InputMode, LearningRequest, LearningResult, JapaneseCheckResponse, TranslationOption } from './types';

export const DEFAULT_CONTEXT = 'parental casual';

export function resolveTask(mode: InputMode, phrase: string): InputMode {
  if (mode !== 'auto') return mode;
  return /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u.test(phrase) ? 'check' : 'auto';
}

const OPTION_SCHEMA = `{
  "kanji": "<Japanese text with kanji where natural>",
  "reading": "<full kana reading>",
  "romaji": "<Hepburn romaji, lowercase>",
  "register": "<formal | casual | written | honorific | humble | polite>",
  "nuance": "<1-2 sentences explaining usage and nuance in English>"
}`;

const TRANSLATE_PROMPT = `You are a Japanese language tutor. Translate the user's phrase into natural Japanese for the supplied context.
Return exactly 3 translation options, meaningfully varied in register or nuance, not near-duplicates.
Return ONLY a raw JSON object, no markdown or commentary, with this schema:
{"options": [${OPTION_SCHEMA}]}
The options array must contain exactly three complete objects. Use hiragana readings except where katakana is appropriate.`;

const CHECK_PROMPT = `You are a supportive, precise Japanese language tutor. Check the user's Japanese attempt (which may be in romaji or mixed script) in the supplied context. Teach in English.
The context field is optional free-form learner notes: it may describe audience/register, an intended English meaning, or both. Only compare meaning when the notes actually state an intended meaning. Audience/register notes alone (including the default parental casual) are NOT an intended meaning: use meaningMatch verdict not_provided and an empty explanation. If the notes state intended English, compare the actual meaning to it and make your recommendation express that intent. First explain what the attempt actually conveys, separately from intent. Otherwise explicitly flag ambiguity and state any assumption; do not silently invent intent. A short unambiguous phrase is fine; uncertainty does not mean incorrect.
Assess grammar separately from naturalness and contextual register. Distinguish actual errors, naturalness improvements, and optional stylistic preferences. Explain the specific particle, grammar, vocabulary, or phrasing issue and why the replacement works. Do not invent mistakes or insist that every valid phrase needs rewriting.
Return one best natural version. If the original is grammatical, natural, appropriate for context, and conveys the supplied intent (if any), explicitly confirm this, keep its wording unchanged, and return an empty corrections array. For romaji, render the same wording in Japanese script. Return originalJapanese as a faithful Japanese-script transcription of the ORIGINAL attempt, keeping any grammar mistakes; put corrections only in the recommendation. For script input, originalJapanese repeats the original attempt. Romaji may have typos, missing spaces, or mixed script: explain uncertain readings in interpretationNote rather than silently changing the intended words. If intent differs, correct toward the supplied intent even if the original is otherwise natural.
Break the recommendation into meaningful chunks in order, covering the complete phrase, with kana readings and explanations of vocabulary, particles, grammar, and phrasing. Do not split into isolated characters. Keep the recommendation's nuance to a short usage note; detailed teaching belongs in the assessments, corrections, and breakdown.
Return ONLY raw JSON, no markdown or commentary, with this schema:
{
  "originalJapanese": "<original attempt transcribed into Japanese script, without grammatical corrections>",
  "interpretation": "<English meaning of the original attempt>",
  "interpretationNote": "<uncertainty and assumed intent, or empty string if unambiguous>",
  "grammar": {"verdict": "<correct | needs_work | uncertain>", "explanation": "<assessment with reasons>"},
  "naturalness": {"verdict": "<natural | needs_work | uncertain>", "explanation": "<assessment for the supplied context with reasons>"},
  "meaningMatch": {"verdict": "<matches | differs | uncertain | not_provided>", "explanation": "<explain comparison with intent from context notes; when no intent is stated use verdict not_provided and empty explanation>"},
  "corrections": [{"kind": "<error | naturalness | style>", "original": "<original wording>", "replacement": "<replacement wording>", "explanation": "<why this change helps; identify optional changes as optional>"}],
  "recommendation": {"english": "<English meaning of the recommended version, suitable as a flashcard prompt>", ${OPTION_SCHEMA.slice(1, -1)}},
  "breakdown": [{"text": "<chunk of recommended Japanese>", "reading": "<kana reading>", "explanation": "<English teaching explanation>"}]
}
The breakdown must contain at least one chunk. All fields are required. Use only the listed verdict and kind values.`;

const AUTO_PROMPT = `Decide whether the user's phrase is English to translate or a Japanese attempt to check, including Japanese written in Latin letters (romaji).
Use the phrase itself as primary evidence, and context notes to resolve ambiguity. For example "mizu o nomitai", "kyou wa samui desu", and "arigatou" are Japanese attempts; "I want water", "can you help me", and "no" are English to translate. Do not treat English as romaji just because its letters could be transliterated. For genuinely ambiguous short Latin input prefer English translation; the user can explicitly select Check Japanese. Recognize likely learner errors and typos in romaji as attempts to check, not requests to translate. Do not use a separate detection request.
Return ONLY raw JSON using exactly one of these envelopes:
{"task":"translate","response":<the translation JSON object described below>}
{"task":"check","response":<the Japanese check JSON object described below>}
Follow the instructions for the chosen task. The chosen task determines the response schema.

TRANSLATION INSTRUCTIONS:
${TRANSLATE_PROMPT}

JAPANESE CHECK INSTRUCTIONS:
${CHECK_PROMPT}
For Auto, always use the outer task/response envelope above, even though the task instructions show the inner response schema.`;

export function buildLearningPrompt(request: LearningRequest): { system: string; user: string; maxTokens: number } {
  return {
    system: request.task === 'auto' ? AUTO_PROMPT : request.task === 'check' ? CHECK_PROMPT : TRANSLATE_PROMPT,
    // JSON keeps the learner's text distinct from the tutor's instructions.
    user: JSON.stringify({ phrase: request.phrase, context: request.context.trim() || DEFAULT_CONTEXT }),
    maxTokens: request.task === 'translate' ? 1024 : 4096,
  };
}

function object(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`Unexpected response: ${path} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function string(value: unknown, path: string, allowEmpty = false): string {
  if (typeof value !== 'string' || (!allowEmpty && !value.trim())) {
    throw new Error(`Unexpected response: ${path} must be ${allowEmpty ? 'a string' : 'a nonempty string'}.`);
  }
  return value;
}

function choice<T extends string>(value: unknown, allowed: readonly T[], path: string): T {
  if (!allowed.includes(value as T)) throw new Error(`Unexpected response: invalid ${path}.`);
  return value as T;
}

function option(value: unknown, path: string): TranslationOption {
  const data = object(value, path);
  return {
    kanji: string(data.kanji, `${path}.kanji`),
    reading: string(data.reading, `${path}.reading`),
    romaji: string(data.romaji, `${path}.romaji`),
    register: choice(data.register, ['formal', 'casual', 'written', 'honorific', 'humble', 'polite'], `${path}.register`),
    nuance: string(data.nuance, `${path}.nuance`),
  };
}

function assessment<T extends string>(value: unknown, verdicts: readonly T[], path: string, allowEmpty = false) {
  const data = object(value, path);
  return {
    verdict: choice(data.verdict, verdicts, `${path}.verdict`),
    explanation: string(data.explanation, `${path}.explanation`, allowEmpty),
  };
}

// A model may omit this optional comparison or return a verdict without reasons.
// Hide an incomplete comparison instead of discarding the usable teaching response.
function parseMeaningMatch(value: unknown): JapaneseCheckResponse['meaningMatch'] {
  const absent = { verdict: 'not_provided' as const, explanation: '' };
  if (value == null) return absent;
  const data = object(value, 'meaningMatch');
  const verdict = choice(data.verdict, ['matches', 'differs', 'uncertain', 'not_provided'] as const, 'meaningMatch.verdict');
  if (verdict === 'not_provided' || data.explanation == null || data.explanation === '') return absent;
  const explanation = string(data.explanation, 'meaningMatch.explanation', true).trim();
  return explanation ? { verdict, explanation } : absent;
}

export function parseLearningResponse(raw: string, task: InputMode): LearningResult {
  const cleaned = raw.trim().replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '').trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error('The provider returned invalid JSON. Please try again.');
  }
  let data = object(parsed, 'response');
  if (task === 'auto') {
    task = choice(data.task, ['translate', 'check'] as const, 'task');
    data = object(data.response, 'response');
  }
  if (task === 'translate') {
    if (!Array.isArray(data.options) || data.options.length !== 3) {
      throw new Error('Unexpected response: expected exactly 3 translation options.');
    }
    return { task, response: { options: data.options.map((value, i) => option(value, `options[${i}]`)) } };
  }
  const recommendation = object(data.recommendation, 'recommendation');
  if (!Array.isArray(data.corrections)) throw new Error('Unexpected response: corrections must be an array.');
  if (!Array.isArray(data.breakdown) || data.breakdown.length === 0) {
    throw new Error('Unexpected response: breakdown must contain at least one chunk.');
  }
  const response: JapaneseCheckResponse = {
    ...(typeof data.originalJapanese === 'string' && data.originalJapanese.trim()
      ? { originalJapanese: data.originalJapanese } : {}),
    interpretation: string(data.interpretation, 'interpretation'),
    interpretationNote: string(data.interpretationNote, 'interpretationNote', true),
    grammar: assessment(data.grammar, ['correct', 'needs_work', 'uncertain'] as const, 'grammar'),
    naturalness: assessment(data.naturalness, ['natural', 'needs_work', 'uncertain'] as const, 'naturalness'),
    meaningMatch: parseMeaningMatch(data.meaningMatch),
    corrections: data.corrections.map((value, i) => {
      const item = object(value, `corrections[${i}]`);
      return {
        kind: choice(item.kind, ['error', 'naturalness', 'style'] as const, 'correction.kind'),
        original: string(item.original, 'correction.original'),
        replacement: string(item.replacement, 'correction.replacement'),
        explanation: string(item.explanation, 'correction.explanation'),
      };
    }),
    recommendation: { ...option(recommendation, 'recommendation'), english: string(recommendation.english, 'recommendation.english') },
    breakdown: data.breakdown.map((value, i) => {
      const item = object(value, `breakdown[${i}]`);
      return {
        text: string(item.text, 'breakdown.text'),
        reading: string(item.reading, 'breakdown.reading'),
        explanation: string(item.explanation, 'breakdown.explanation'),
      };
    }),
  };
  return { task, response };
}
