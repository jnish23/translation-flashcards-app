import { test } from 'node:test';
import assert from 'node:assert/strict';
import { serializeBackup, parseBackup, mergeCards } from '../src/backup';
import type { Card } from '../src/types';
const card: Card = { id: 'one', card_type: 'production', prompt: 'Hello', context: 'friend', kanji: 'こんにちは', reading: 'こんにちは', romaji: 'konnichiwa', register: 'polite', nuance: 'Greeting', repetitions: 4, ease_factor: 2.5, interval: 35, due_date: '2026-11-10T00:00:00Z', created_at: '2026-10-01T00:00:00Z' };
test('round trip preserves every field and review history', () => assert.deepEqual(parseBackup(serializeBackup([card])), [card]));
test('invalid and unsupported files fail before merge', () => {
  for (const input of ['bad', '{}', '{"version":2,"cards":[]}', JSON.stringify({ version: 1, cards: [card, { ...card, interval: -1 }] })]) assert.throws(() => parseBackup(input));
});
test('existing and incoming duplicate IDs are skipped; existing history wins', () => {
  const result = mergeCards([card], [{ ...card, repetitions: 0 }, { ...card, id: 'two' }, { ...card, id: 'two' }]);
  assert.equal(result.imported, 1); assert.equal(result.skipped, 2); assert.deepEqual(result.cards[0], card);
});
test('import strips unrelated fields, including credentials', () => {
  const parsed = parseBackup(JSON.stringify({ version: 1, apiKey: 'secret', cards: [{ ...card, apiKey: 'secret' }] }));
  assert.ok(!serializeBackup(parsed).includes('secret'));
});
