import { describe, expect, test } from 'vitest';
import { newCard, rateCard } from '@/domain/fsrs';

const now = new Date('2026-11-16T10:00:00Z');

describe('fsrs', () => {
  test('new card is due now and has reps 0', () => {
    const c = newCard('der-tisch', 'de_en', now);
    expect(c.id).toBe('der-tisch:de_en');
    expect(c.fsrs.reps).toBe(0);
    expect(new Date(c.fsrs.due).getTime()).toBe(now.getTime());
    expect(c.dirty).toBe(1);
  });
  test('newCard respects dueAt', () => {
    const later = new Date('2026-11-17T02:00:00Z');
    expect(newCard('x', 'en_de', now, later).fsrs.due).toBe(later.toISOString());
  });
  test('rating Good increments reps and moves due into the future', () => {
    const c = rateCard(newCard('x', 'de_en', now), 3, now);
    expect(c.fsrs.reps).toBe(1);
    expect(new Date(c.fsrs.due).getTime()).toBeGreaterThan(now.getTime());
    expect(c.updatedAt).toBe(now.toISOString());
  });
  test('rating Again on review card increments lapses', () => {
    let c = rateCard(newCard('x', 'de_en', now), 4, now); // Easy -> review state
    const later = new Date(c.fsrs.due);
    c = rateCard(c, 1, later);
    expect(c.fsrs.lapses).toBe(1);
  });
  test('round-trip keeps ISO strings', () => {
    const c = rateCard(newCard('x', 'de_en', now), 3, now);
    expect(typeof c.fsrs.due).toBe('string');
    expect(typeof c.fsrs.last_review).toBe('string');
    expect(JSON.parse(JSON.stringify(c))).toEqual(c);
  });
  test('scheduling is deterministic (no fuzz)', () => {
    let a = rateCard(newCard('x', 'de_en', now), 4, now);
    let b = rateCard(newCard('x', 'de_en', now), 4, now);
    const t = new Date(a.fsrs.due);
    a = rateCard(a, 3, t);
    b = rateCard(b, 3, t);
    expect(a.fsrs.due).toBe(b.fsrs.due);
  });
});

describe('updatedAt is monotonic per card', () => {
  test('rating with a clock behind the last write still produces a newer updatedAt', () => {
    const c = rateCard(newCard('x', 'de_en', now), 3, new Date(now.getTime() + 10 * 60_000)); // written by a fast clock
    const behind = new Date(now.getTime() + 5 * 60_000);
    const next = rateCard(c, 3, behind);
    expect(next.updatedAt > c.updatedAt).toBe(true);
  });
});
