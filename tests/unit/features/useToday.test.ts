import { describe, expect, test } from 'vitest';
import { computeToday } from '@/features/today/useToday';
import { newCard } from '@/domain/fsrs';
import { localDay } from '@/domain/day';
import type { CardRecord, Profile, ReviewRecord, Word } from '@/domain/types';

const now = new Date(2026, 10, 16, 18, 0);
const profile: Profile = { id: 'p', displayName: 'Nikola', dailyGoalMin: 15, newPerDay: 3, showPl: true };
const word = (id: string): Word => ({ id, de: id, pos: 'verb', en: id, cefr: 'A1', topic: 't', example_de: 'x', example_en: 'x' });
const words = ['a', 'b', 'c', 'd', 'e'].map(word);
const dueCard = (id: string): CardRecord => {
  const c = newCard(id, 'de_en', now, new Date(now.getTime() - 60_000));
  return { ...c, fsrs: { ...c.fsrs, reps: 2, state: 2 } };
};
const rev = (at: Date, p: Partial<ReviewRecord> = {}): ReviewRecord => ({
  id: Math.random().toString(), cardId: 'x:de_en', rating: 3, durationMs: 120_000, reviewedAt: at.toISOString(),
  localDay: localDay(at), wasNew: false, closesQueue: false, scheduledDays: 3, synced: 0, ...p,
});

describe('computeToday', () => {
  test('counts due reviews and new words like the session builder', () => {
    const t = computeToday({ cards: [dueCard('a'), dueCard('b')], reviews: [], words, profile, now });
    expect(t.dueCount).toBe(2);
    expect(t.newCount).toBe(3);
    expect(t.goalMet).toBe(false);
    expect(t.goalMin).toBe(15);
  });
  test('minutesToday sums durations of today only', () => {
    const yesterday = new Date(2026, 10, 15, 18, 0);
    const t = computeToday({ cards: [], reviews: [rev(now), rev(now), rev(yesterday)], words, profile, now });
    expect(t.minutesToday).toBeCloseTo(4);
  });
  test('goal met after closesQueue', () => {
    const t = computeToday({ cards: [], reviews: [rev(now, { closesQueue: true })], words, profile, now });
    expect(t.goalMet).toBe(true);
    expect(t.streak).toBe(1);
  });
  test('streak and freezes come from computeStreak', () => {
    const reviews = Array.from({ length: 7 }, (_, i) => rev(new Date(2026, 10, 9 + i, 12, 0), { closesQueue: true }));
    const t = computeToday({ cards: [], reviews, words, profile, now });
    expect(t.streak).toBe(7);
    expect(t.freezes).toBe(1);
  });
});
