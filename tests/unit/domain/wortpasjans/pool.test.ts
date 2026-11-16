import { describe, expect, test } from 'vitest';
import { srsRank } from '@/domain/wortpasjans/pool';
import { newCard } from '@/domain/fsrs';
import type { CardRecord, Word } from '@/domain/types';

const now = new Date(2026, 10, 16, 12);
const word = (id: string): Word => ({ id, de: id, pos: 'verb', en: id, cefr: 'A1', topic: 't', example_de: 'x', example_en: 'x' });
const words = ['a', 'b', 'c', 'd', 'e'].map(word);
const card = (id: string, stability: number, dueInMin: number): CardRecord => {
  const c = newCard(id, 'de_en', now, new Date(now.getTime() + dueInMin * 60_000));
  return { ...c, fsrs: { ...c.fsrs, reps: 3, stability } };
};

describe('srsRank', () => {
  test('due/learning first, then known, then not started (in introduction order)', () => {
    const rank = srsRank(words, [card('d', 20, 60 * 24 * 5), card('e', 2, -10), card('b', 3, 60 * 24)], now);
    const order = [...words].sort((x, y) => rank(x) - rank(y)).map((w) => w.id);
    expect(order).toEqual(['e', 'b', 'd', 'a', 'c']);
  });
});
