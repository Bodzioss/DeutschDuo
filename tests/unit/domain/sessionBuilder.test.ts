import { describe, expect, test } from 'vitest';
import { buildSession, shouldRequeue } from '@/domain/sessionBuilder';
import { newCard } from '@/domain/fsrs';
import { localDay } from '@/domain/day';
import type { CardRecord, ReviewRecord, Word } from '@/domain/types';

const now = new Date(2026, 10, 16, 12, 0);
const word = (id: string): Word => ({ id, de: id, pos: 'verb', en: id, cefr: 'A1', topic: 't', example_de: 'x', example_en: 'x' });
const words = Array.from({ length: 30 }, (_, i) => word(`w${i}`));
const due = (wordId: string, minutesAgo: number, dir: 'de_en' | 'en_de' = 'de_en'): CardRecord => {
  const c = newCard(wordId, dir, now, new Date(now.getTime() - minutesAgo * 60_000));
  return { ...c, fsrs: { ...c.fsrs, reps: 2, state: 2 } };
};
const rev = (cardId: string, wasNew: boolean): ReviewRecord => ({
  id: Math.random().toString(), cardId, rating: 3, durationMs: 1000, reviewedAt: now.toISOString(),
  localDay: localDay(now), wasNew, closesQueue: false, scheduledDays: 1, synced: 0,
});
const base = { words, reviewsToday: [] as ReviewRecord[], now, newPerDay: 0 };

describe('buildSession', () => {
  test('due cards sorted by due ascending', () => {
    const s = buildSession({ ...base, cards: [due('w1', 10), due('w2', 100), due('w3', 50)] });
    expect(s.map((i) => i.wordId)).toEqual(['w2', 'w3', 'w1']);
    expect(s.every((i) => !i.isNew)).toBe(true);
  });
  test('cards with due in the future are excluded', () => {
    const s = buildSession({ ...base, cards: [due('w1', 10), due('w2', -60 * 24, 'en_de')] });
    expect(s.map((i) => i.cardId)).toEqual(['w1:de_en']);
  });
  test('400 overdue cards → at most 150 reviews', () => {
    const cards = Array.from({ length: 400 }, (_, i) => due(`x${i}`, i + 1));
    expect(buildSession({ ...base, cards }).length).toBe(150);
  });
  test('with 100 non-new reviews done today → at most 50', () => {
    const cards = Array.from({ length: 400 }, (_, i) => due(`x${i}`, i + 1));
    const reviewsToday = Array.from({ length: 100 }, (_, i) => rev(`y${i}:de_en`, false));
    expect(buildSession({ ...base, cards, reviewsToday }).length).toBe(50);
  });
  test('new words taken in words[] order, skipping words that already have a de_en card', () => {
    const s = buildSession({ ...base, cards: [due('w0', -1000), due('w2', -1000)], newPerDay: 3 });
    expect(s.map((i) => i.cardId)).toEqual(['w1:de_en', 'w3:de_en', 'w4:de_en']);
    expect(s.every((i) => i.isNew && i.direction === 'de_en')).toBe(true);
  });
  test('newPerDay 10 with 4 new words already introduced today → 6 new', () => {
    const reviewsToday = [0, 1, 2, 3].map((i) => rev(`z${i}:de_en`, true));
    expect(buildSession({ ...base, cards: [], newPerDay: 10, reviewsToday }).length).toBe(6);
  });
  test('first review of en_de card today does not count as a new word', () => {
    const reviewsToday = [rev('z0:en_de', true)];
    expect(buildSession({ ...base, cards: [], newPerDay: 2, reviewsToday }).length).toBe(2);
  });
  test('new items interleaved: one new after every 3 reviews, rest appended', () => {
    const cards = Array.from({ length: 6 }, (_, i) => due(`r${i}`, 10 - i));
    const s = buildSession({ ...base, cards, newPerDay: 3 });
    expect(s.map((i) => (i.isNew ? 'N' : 'R')).join('')).toBe('RRRNRRRNN');
  });
  test('no due and no new → empty session', () => {
    expect(buildSession({ ...base, words: [], cards: [] })).toEqual([]);
  });
});

describe('shouldRequeue', () => {
  test('due in 5 min → true', () => {
    expect(shouldRequeue(newCard('a', 'de_en', now, new Date(now.getTime() + 5 * 60_000)), now)).toBe(true);
  });
  test('due in 1 day → false', () => {
    expect(shouldRequeue(newCard('a', 'de_en', now, new Date(now.getTime() + 86_400_000)), now)).toBe(false);
  });
});
