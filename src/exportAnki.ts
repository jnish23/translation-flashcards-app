import { exportFile } from './native';
import type { Card } from './types';

function sanitizeField(s: string): string {
  return s.replace(/[\t\r\n]+/g, ' ').trim();
}

export async function exportToAnki(cards: Card[]): Promise<void> {
  const rows = cards.map((card) => {
    const front = card.context
      ? sanitizeField(`${card.prompt} (${card.context})`)
      : sanitizeField(card.prompt);

    const back = `${sanitizeField(card.kanji)} [${sanitizeField(card.reading)}]<br>${sanitizeField(card.nuance)}`;

    const tags = `${card.card_type} japanese-srs`;

    return [front, back, tags].join('\t');
  });

  const tsv = rows.join('\n');
  await exportFile('japanese-srs-export.txt', tsv, 'text/plain;charset=utf-8');
}
