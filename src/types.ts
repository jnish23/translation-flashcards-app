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

export type LearningTask = 'translate' | 'check';
export type InputMode = 'auto' | LearningTask;

export interface LearningRequest {
  task: InputMode;
  phrase: string;
  context: string;
}

export interface JapaneseCheckResponse {
  originalJapanese?: string;
  interpretation: string;
  interpretationNote: string;
  grammar: { verdict: 'correct' | 'needs_work' | 'uncertain'; explanation: string };
  naturalness: { verdict: 'natural' | 'needs_work' | 'uncertain'; explanation: string };
  meaningMatch: { verdict: 'matches' | 'differs' | 'uncertain' | 'not_provided'; explanation: string };
  corrections: { kind: 'error' | 'naturalness' | 'style'; original: string; replacement: string; explanation: string }[];
  recommendation: TranslationOption & { english: string };
  breakdown: { text: string; reading: string; explanation: string }[];
}

export type LearningResult =
  | { task: 'translate'; response: TranslationResponse }
  | { task: 'check'; response: JapaneseCheckResponse };

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
