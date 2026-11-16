import { describe, expect, test } from 'vitest';
import {
  DUEL_LEVELS, duelForDay, duelGameOf, duelWinner, gameXp, pairStreak, reviewXp, standings, weekDays, weekGoalPct, weekStart, type Player,
} from '@/domain/pair';
import { dailyActivity } from '@/domain/streak';
import type { GameRecord, ReviewRecord } from '@/domain/types';

const rev = (day: string, p: Partial<ReviewRecord> = {}): ReviewRecord => ({
  id: Math.random().toString(), cardId: 'a:de_en', rating: 3, durationMs: 60_000, reviewedAt: `${day}T12:00:00.000Z`, localDay: day,
  wasNew: false, closesQueue: false, scheduledDays: 1, goalMin: 15, synced: 1, ...p,
});
const game = (day: string, p: Partial<GameRecord> = {}): GameRecord => ({
  id: Math.random().toString(), level: 'berlin-1', seed: 1, won: true, stars: 3, moves: 20, par: 18, peeks: 0, peekedWordIds: [],
  durationMs: 100_000, playedAt: `${day}T18:00:00.000Z`, localDay: day, synced: 1, ...p,
});

describe('week', () => {
  test('weeks start on Monday', () => {
    expect(weekStart('2026-11-16')).toBe('2026-11-16'); // Monday
    expect(weekStart('2026-11-22')).toBe('2026-11-16'); // Sunday
    expect(weekStart('2026-11-23')).toBe('2026-11-23');
  });
  test('weekDays runs from Monday to the given day', () => {
    expect(weekDays('2026-11-18')).toEqual(['2026-11-16', '2026-11-17', '2026-11-18']);
  });
});

describe('xp', () => {
  test('reviews: DE→EN 1, EN→DE 2, Again 0', () => {
    expect(reviewXp(rev('d'))).toBe(1);
    expect(reviewXp(rev('d', { cardId: 'a:en_de' }))).toBe(2);
    expect(reviewXp(rev('d', { rating: 1 }))).toBe(0);
  });
  test('games: 3 per star', () => expect(gameXp(game('d', { stars: 2 }))).toBe(6));
});

describe('weekGoalPct', () => {
  test('mean over days since Monday; today counts only once started', () => {
    const a = dailyActivity([rev('2026-11-16', { durationMs: 15 * 60_000 }), rev('2026-11-17', { durationMs: 7.5 * 60_000 })]);
    expect(weekGoalPct(a, '2026-11-18', 15)).toBeCloseTo(0.75); // Mon 100%, Tue 50%, Wed (today, empty) ignored
    const b = dailyActivity([...[rev('2026-11-16', { durationMs: 15 * 60_000 })], rev('2026-11-18', { durationMs: 3 * 60_000 })]);
    expect(weekGoalPct(b, '2026-11-18', 15)).toBeCloseTo((1 + 0 + 0.2) / 3);
  });
  test('a closed queue counts as 100% even with few minutes; snapshot goal is used', () => {
    const a = dailyActivity([rev('2026-11-16', { durationMs: 60_000, closesQueue: true }), rev('2026-11-17', { durationMs: 10 * 60_000, goalMin: 10 })]);
    expect(weekGoalPct(a, '2026-11-17', 30)).toBeCloseTo(1);
  });
});

describe('standings', () => {
  const mk = (id: string, reviews: ReviewRecord[], games: GameRecord[] = []): Player => ({ profileId: id, name: id, goalMin: 15, reviews, games });
  test('goal % first, XP breaks ties', () => {
    const steady = mk('steady', [rev('2026-11-16', { durationMs: 15 * 60_000 }), rev('2026-11-17', { durationMs: 15 * 60_000 })]);
    const binge = mk('binge', [...Array.from({ length: 40 }, () => rev('2026-11-16', { durationMs: 2 * 60_000 }))]);
    const s = standings([binge, steady], '2026-11-18'); // Wed morning: Mon+Tue count, today not started
    expect(s.map((x) => x.profileId)).toEqual(['steady', 'binge']);
    expect(s[1].xp).toBeGreaterThan(s[0].xp);
  });
  test('only this week counts', () => {
    const s = standings([mk('a', [rev('2026-11-15', { durationMs: 99 * 60_000 })])], '2026-11-17');
    expect(s[0]).toMatchObject({ xp: 0, goalPct: 0, daysMet: 0 });
  });
  test('duel wins add 10 XP each', () => {
    const d = '2026-11-16';
    const a = mk('a', [], [game(d, { duelDay: d, moves: 20 })]);
    const b = mk('b', [], [game(d, { duelDay: d, moves: 25 })]);
    const s = standings([a, b], '2026-11-16');
    expect(s.find((x) => x.profileId === 'a')!.xp - s.find((x) => x.profileId === 'b')!.xp).toBe(10);
    expect(s.find((x) => x.profileId === 'a')!.duelWins).toBe(1);
  });
});

describe('pairStreak', () => {
  test('counts consecutive days both met their goal, today only when both did', () => {
    const met = (d: string) => rev(d, { closesQueue: true });
    const a = dailyActivity(['2026-11-14', '2026-11-15', '2026-11-16'].map(met));
    const b = dailyActivity(['2026-11-15', '2026-11-16'].map(met));
    expect(pairStreak(a, b, '2026-11-17', 15, 15)).toBe(2);
    expect(pairStreak(a, b, '2026-11-16', 15, 15)).toBe(2); // today (16th) both met → counted
    expect(pairStreak(a, dailyActivity([]), '2026-11-17', 15, 15)).toBe(0);
  });
});

describe('duel', () => {
  test('seed and level are deterministic per day and rotate over Berlin–München', () => {
    expect(duelForDay('2026-11-16')).toEqual(duelForDay('2026-11-16'));
    expect(duelForDay('2026-11-16').seed).not.toBe(duelForDay('2026-11-17').seed);
    expect(DUEL_LEVELS).toHaveLength(15);
    const levels = new Set(Array.from({ length: 15 }, (_, i) => duelForDay(`2026-12-${String(i + 1).padStart(2, '0')}`).levelId));
    expect(levels.size).toBe(15);
  });
  test('only the first duel game of the day counts', () => {
    const first = game('2026-11-16', { duelDay: '2026-11-16', playedAt: '2026-11-16T10:00:00.000Z', moves: 40 });
    const second = game('2026-11-16', { duelDay: '2026-11-16', playedAt: '2026-11-16T11:00:00.000Z', moves: 10 });
    expect(duelGameOf([second, first, game('2026-11-16')], '2026-11-16')).toBe(first);
    expect(duelGameOf([], '2026-11-16')).toBeUndefined();
  });
  test('winner: won > fewer moves > shorter time > fewer peeks > draw', () => {
    const g = (p: Partial<GameRecord>) => game('d', p);
    expect(duelWinner(g({ won: true, moves: 50 }), g({ won: false, moves: 10 }))).toBe('a');
    expect(duelWinner(g({ moves: 30 }), g({ moves: 20 }))).toBe('b');
    expect(duelWinner(g({ durationMs: 50 }), g({ durationMs: 60 }))).toBe('a');
    expect(duelWinner(g({ peeks: 2 }), g({ peeks: 1 }))).toBe('b');
    expect(duelWinner(g({}), g({}))).toBe('draw');
    expect(duelWinner(g({}), undefined)).toBeNull();
  });
});
