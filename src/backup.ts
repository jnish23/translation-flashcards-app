import type { Card } from './types';
const strings = ['id', 'prompt', 'context', 'kanji', 'reading', 'romaji', 'register', 'nuance'] as const;
export function serializeBackup(cards: Card[]): string {
  return JSON.stringify({ version: 1, cards }, null, 2);
}
export function parseBackup(text: string): Card[] {
  const data: unknown = JSON.parse(text);
  if (!data || typeof data !== 'object' || !('version' in data) || data.version !== 1 || !('cards' in data) || !Array.isArray(data.cards)) throw new Error('Choose a version 1 Japanese Flashcards JSON backup.');
  return data.cards.map((value: unknown) => {
    if (!value || typeof value !== 'object') throw new Error('Invalid card in backup. Nothing was imported.');
    const c = value as Record<string, unknown>;
    if (strings.some(k => typeof c[k] !== 'string') || !c.id || !['production', 'recognition'].includes(String(c.card_type)) ||
      ['due_date', 'created_at'].some(k => typeof c[k] !== 'string' || !Number.isFinite(Date.parse(c[k] as string))) ||
      ['repetitions', 'ease_factor', 'interval'].some(k => typeof c[k] !== 'number' || !Number.isFinite(c[k]) || (c[k] as number) < 0) ||
      !Number.isInteger(c.repetitions) || (c.ease_factor as number) < 1.3) throw new Error('Invalid card in backup. Nothing was imported.');
    // Whitelist fields: credentials or unrelated properties never enter backups.
    return Object.fromEntries([...strings, 'card_type', 'due_date', 'created_at', 'repetitions', 'ease_factor', 'interval'].map(k => [k, c[k]])) as unknown as Card;
  });
}
export function mergeCards(existing: Card[], incoming: Card[]) {
  const ids = new Set(existing.map(c => c.id));
  const cards = [...existing];
  let skipped = 0;
  for (const card of incoming) {
    if (ids.has(card.id)) skipped++;
    else { cards.push(card); ids.add(card.id); }
  }
  return { cards, imported: cards.length - existing.length, skipped };
}
