import type { Card } from './types';

const STORAGE_KEY = 'flashcards';

export function loadCards(): Card[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
  } catch {
    return [];
  }
}

export function persistCard(card: Card): Card[] {
  const cards = loadCards();
  cards.push(card);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cards));
  return cards;
}

export function removeCard(id: string): Card[] {
  const cards = loadCards().filter((c) => c.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cards));
  return cards;
}

export function updateCard(updated: Card): Card[] {
  const cards = loadCards().map((c) => (c.id === updated.id ? updated : c));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cards));
  return cards;
}
