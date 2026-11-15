import { describe, expect, test } from 'vitest';
import { hardestWords, knownOverTime, minutesPerDay, retention30d } from '@/domain/stats';
import { newCard } from '@/domain/fsrs';
import type { CardRecord, ReviewRecord } from '@/domain/types';
import type { DayActivity } from '@/domain/streak';

const rev = (cardId: string, localDay: string, p: Partial<ReviewRecord> = {}): ReviewRecord => ({
  id: Math.random().toString(), cardId, rating: 3, durationMs: 1000, reviewedAt: `${localDay}T12:00:00.000Z`,
  localDay, wasNew: false, closesQueue: false, scheduledDays: 1, synced: 0, ...p,
});

describe('knownOverTime', () => {
  test('word counts from the day its last review reached ≥7 days', () => {
    const reviews = [
      rev('a:de_en', '2026-11-01', { scheduledDays: 2 }),
      rev('a:de_en', '2026-11-03', { scheduledDays: 8 }),
      rev('a:en_de', '2026-11-04', { scheduledDays: 9 }),
      rev('b:de_en', '2026-11-02', { scheduledDays: 10 }),
      rev('b:de_en', '2026-11-04', { scheduledDays: 1, rating: 1 }), // lapsed
    ];
    const r = knownOverTime(reviews, ['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04']);
    expect(r.map((x) => x.known)).toEqual([0, 1, 2, 1]);
  });
});

describe('retention30d', () => {
  test('share of non-Again among non-new reviews in last 30 days', () => {
    const reviews = [
      rev('a:de_en', '2026-11-10'),
      rev('a:de_en', '2026-11-11', { rating: 1 }),
      rev('b:de_en', '2026-11-12', { rating: 1, wasNew: true }), // ignored: new
      rev('c:de_en', '2026-10-10', { rating: 1 }), // ignored: older than 30 days
    ];
    expect(retention30d(reviews, '2026-11-16')).toBe(0.5);
  });
  test('null without data', () => expect(retention30d([], '2026-11-16')).toBeNull());
});

describe('minutesPerDay', () => {
  test('maps days to minutes, 0 when missing', () => {
    const a = new Map<string, DayActivity>([['2026-11-02', { day: '2026-11-02', reviews: 1, newWords: 0, minutes: 12.5, queueClosed: false }]]);
    expect(minutesPerDay(a, ['2026-11-01', '2026-11-02'])).toEqual([0, 12.5]);
  });
});

describe('hardestWords', () => {
  const card = (wordId: string, dir: 'de_en' | 'en_de', lapses: number): CardRecord => {
    const c = newCard(wordId, dir, new Date());
    return { ...c, fsrs: { ...c.fsrs, lapses } };
  };
  test('sums lapses of both cards, sorted desc, only > 0', () => {
    const r = hardestWords([card('a', 'de_en', 1), card('a', 'en_de', 3), card('b', 'de_en', 2), card('c', 'de_en', 0)]);
    expect(r).toEqual([{ wordId: 'a', lapses: 4 }, { wordId: 'b', lapses: 2 }]);
  });
  test('limits to n', () => {
    expect(hardestWords([card('a', 'de_en', 1), card('b', 'de_en', 2)], 1)).toEqual([{ wordId: 'b', lapses: 2 }]);
  });
});
