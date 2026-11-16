import { describe, expect, test } from 'vitest';
import { computeStreak, dailyActivity, isGoalMet, type DayActivity } from '@/domain/streak';
import { localDay } from '@/domain/day';
import type { ReviewRecord } from '@/domain/types';

const GOAL = 15;
function addDays(day: string, n: number): string {
  const [y, m, d] = day.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}
const met = (day: string): DayActivity => ({ day, reviews: 30, newWords: 5, minutes: 20, queueClosed: false });
function activity(start: string, pattern: string): Map<string, DayActivity> {
  // pattern: 'x' = goal met, '.' = nothing
  const m = new Map<string, DayActivity>();
  [...pattern].forEach((ch, i) => { if (ch === 'x') { const d = addDays(start, i); m.set(d, met(d)); } });
  return m;
}
const START = '2026-11-01';
const todayAfter = (pattern: string) => addDays(START, pattern.length);

describe('computeStreak', () => {
  test('7 consecutive met days → current 7, freezes 1', () => {
    const p = 'xxxxxxx';
    const r = computeStreak(activity(START, p), todayAfter(p), GOAL);
    expect(r.current).toBe(7);
    expect(r.freezes).toBe(1);
  });
  test('14 days → freezes 2; 21 days → freezes still 2', () => {
    expect(computeStreak(activity(START, 'x'.repeat(14)), todayAfter('x'.repeat(14)), GOAL).freezes).toBe(2);
    expect(computeStreak(activity(START, 'x'.repeat(21)), todayAfter('x'.repeat(21)), GOAL).freezes).toBe(2);
  });
  test('one missed day with a freeze → streak kept, freeze consumed, day in frozenDays', () => {
    const p = 'xxxxxxx.x';
    const r = computeStreak(activity(START, p), todayAfter(p), GOAL);
    expect(r.current).toBe(8);
    expect(r.freezes).toBe(0);
    expect(r.frozenDays).toEqual([addDays(START, 7)]);
  });
  test('missed day without freeze → current 0', () => {
    const p = 'xxx.';
    expect(computeStreak(activity(START, p), todayAfter(p), GOAL).current).toBe(0);
  });
  test('today not met yet does not break streak', () => {
    const p = 'xxx';
    const r = computeStreak(activity(START, p), todayAfter(p), GOAL);
    expect(r.current).toBe(3);
    expect(r.todayMet).toBe(false);
  });
  test('today met adds to streak', () => {
    const p = 'xxx';
    const a = activity(START, p + 'x');
    const r = computeStreak(a, todayAfter(p), GOAL);
    expect(r.current).toBe(4);
    expect(r.todayMet).toBe(true);
  });
  test('10-day gap after 14-day streak → two freezes used, then reset to 0', () => {
    const p = 'x'.repeat(14) + '.'.repeat(10);
    const r = computeStreak(activity(START, p), todayAfter(p), GOAL);
    expect(r.current).toBe(0);
    expect(r.freezes).toBe(0);
    expect(r.frozenDays.length).toBe(2);
  });
  test('empty activity → zero', () => {
    expect(computeStreak(new Map(), '2026-11-16', GOAL)).toEqual({ current: 0, freezes: 0, todayMet: false, frozenDays: [] });
  });
});

describe('isGoalMet', () => {
  test('queueClosed with 3 minutes counts as met', () => {
    expect(isGoalMet({ day: 'd', reviews: 5, newWords: 0, minutes: 3, queueClosed: true }, GOAL)).toBe(true);
  });
  test('14 minutes without closed queue is not met', () => {
    expect(isGoalMet({ day: 'd', reviews: 5, newWords: 0, minutes: 14, queueClosed: false }, GOAL)).toBe(false);
  });
  test('undefined is not met', () => expect(isGoalMet(undefined, GOAL)).toBe(false));
});

describe('dailyActivity', () => {
  const rev = (at: Date, extra: Partial<ReviewRecord> = {}): ReviewRecord => ({
    id: Math.random().toString(), cardId: 'der-tisch:de_en', rating: 3, durationMs: 60_000,
    reviewedAt: at.toISOString(), localDay: localDay(at), wasNew: false, closesQueue: false,
    scheduledDays: 1, synced: 0, ...extra,
  });
  test('review at 01:30 counts toward previous day', () => {
    const a = dailyActivity([rev(new Date(2026, 10, 16, 1, 30))]);
    expect([...a.keys()]).toEqual(['2026-11-15']);
  });
  test('sums minutes, counts new de_en words, flags closed queue', () => {
    const d = new Date(2026, 10, 16, 12, 0);
    const a = dailyActivity([
      rev(d, { wasNew: true }),
      rev(d, { wasNew: true, cardId: 'der-tisch:en_de' }),
      rev(d, { closesQueue: true, durationMs: 30_000 }),
    ]).get('2026-11-16')!;
    expect(a.reviews).toBe(3);
    expect(a.newWords).toBe(1);
    expect(a.minutes).toBeCloseTo(2.5);
    expect(a.queueClosed).toBe(true);
  });
  test('streak from reviews: 01:30 review keeps yesterday alive', () => {
    const days = [13, 14, 15].map((d) => rev(new Date(2026, 10, d, 12, 0), { closesQueue: true }));
    const late = rev(new Date(2026, 10, 17, 1, 30), { closesQueue: true }); // counts for the 16th
    const r = computeStreak(dailyActivity([...days, late]), '2026-11-17', GOAL);
    expect(r.current).toBe(4);
  });
});

describe('daily goal snapshot', () => {
  const r = (at: Date, goalMin: number, durationMs: number): ReviewRecord => ({
    id: Math.random().toString(), cardId: 'a:de_en', rating: 3, durationMs, reviewedAt: at.toISOString(), localDay: localDay(at),
    wasNew: false, closesQueue: false, scheduledDays: 1, goalMin, synced: 0,
  });
  test('raising the goal later does not turn past days into misses', () => {
    // three past days with 16 min each under a 15-min goal; the goal is now 30
    const reviews = [13, 14, 15].map((d) => r(new Date(2026, 10, d, 12), 15, 16 * 60_000));
    expect(computeStreak(dailyActivity(reviews), '2026-11-16', 30).current).toBe(3);
  });
  test('lowering the goal later does not resurrect past misses', () => {
    const reviews = [13, 14, 15].map((d) => r(new Date(2026, 10, d, 12), 30, 16 * 60_000));
    expect(computeStreak(dailyActivity(reviews), '2026-11-16', 15).current).toBe(0);
  });
  test('reviews without a snapshot (older data) fall back to the current goal', () => {
    const legacy = { ...r(new Date(2026, 10, 15, 12), 15, 16 * 60_000) };
    delete (legacy as Partial<ReviewRecord>).goalMin;
    expect(computeStreak(dailyActivity([legacy]), '2026-11-16', 15).current).toBe(1);
  });
});
