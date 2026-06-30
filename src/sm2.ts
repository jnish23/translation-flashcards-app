import type { Card } from './types';

export type Rating = 'again' | 'good';

const MIN_EF = 1.3;
const QUALITY: Record<Rating, number> = { again: 0, good: 4 };

export function applyRating(card: Card, rating: Rating): Card {
  const q = QUALITY[rating];

  // EF = EF + (0.1 - (5-q)*(0.08 + (5-q)*0.02)), floored at 1.3
  const efDelta = 0.1 - (5 - q) * (0.08 + (5 - q) * 0.02);
  const newEF = Math.max(MIN_EF, card.ease_factor + efDelta);

  let newReps: number;
  let newInterval: number;

  if (q < 3) {
    // Failed: reset streak, review tomorrow
    newReps = 0;
    newInterval = 1;
  } else {
    // Correct: advance interval by repetition count
    if (card.repetitions === 0) {
      newInterval = 1;
    } else if (card.repetitions === 1) {
      newInterval = 6;
    } else {
      newInterval = Math.round(card.interval * newEF);
    }
    newReps = card.repetitions + 1;
  }

  return {
    ...card,
    repetitions: newReps,
    ease_factor: newEF,
    interval: newInterval,
    due_date: localMidnight(newInterval),
  };
}

// Returns ISO string of local midnight N days from now.
// Using local midnight means an 11 pm review due "tomorrow" won't
// reappear until the next calendar day in the user's timezone.
function localMidnight(daysFromNow: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString();
}

export function getDueCards(cards: Card[]): Card[] {
  const now = new Date();
  return cards.filter((c) => new Date(c.due_date) <= now);
}
