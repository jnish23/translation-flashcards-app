import type { Card, TranslationOption } from './types';

export function makeCard(
  option: TranslationOption,
  prompt: string,
  context: string,
  card_type: 'production' | 'recognition',
): Card {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    card_type,
    prompt,
    context,
    kanji: option.kanji,
    reading: option.reading,
    romaji: option.romaji,
    register: option.register,
    nuance: option.nuance,
    repetitions: 0,
    ease_factor: 2.5,
    interval: 0,
    due_date: now,
    created_at: now,
  };
}

