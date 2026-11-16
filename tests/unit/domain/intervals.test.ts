import { describe, expect, test } from 'vitest';
import { formatInterval, intervalsFor } from '@/domain/intervals';
import { newCard, rateCard } from '@/domain/fsrs';

const now = new Date(2026, 10, 16, 12, 0);

describe('intervalsFor', () => {
  test('new card: Again < Hard < Good < Easy, all in the future', () => {
    const i = intervalsFor(newCard('a', 'de_en', now), now);
    expect(i[1]).toBeGreaterThan(0);
    expect(i[1]).toBeLessThan(i[3]);
    expect(i[3]).toBeLessThan(i[4]);
    expect(i[2]).toBeLessThanOrEqual(i[3]);
  });
  test('matches what rateCard would schedule', () => {
    const c = rateCard(newCard('a', 'de_en', now), 4, now);
    const t = new Date(c.fsrs.due);
    const i = intervalsFor(c, t);
    expect(i[3]).toBe(new Date(rateCard(c, 3, t).fsrs.due).getTime() - t.getTime());
  });
});

describe('formatInterval', () => {
  test.each([
    [30_000, '<1 min'],
    [60_000, '1 min'],
    [10 * 60_000, '10 min'],
    [90 * 60_000, '2 godz.'],
    [24 * 3600_000, '1 dzień'],
    [3 * 24 * 3600_000, '3 dni'],
    [45 * 24 * 3600_000, '1,5 mies.'],
    [400 * 24 * 3600_000, '1,1 roku'],
  ])('%i ms → %s', (ms, label) => expect(formatInterval(ms)).toBe(label));
});
