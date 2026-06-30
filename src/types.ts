export interface TranslationOption {
  kanji: string;
  reading: string;
  romaji: string;
  register: string;
  nuance: string;
}

export interface TranslationResponse {
  options: TranslationOption[];
}

export interface Card {
  id: string;
  card_type: 'production' | 'recognition';
  prompt: string;
  context: string;
  kanji: string;
  reading: string;
  romaji: string;
  register: string;
  nuance: string;
  repetitions: number;
  ease_factor: number;
  interval: number;
  due_date: string;
  created_at: string;
}
