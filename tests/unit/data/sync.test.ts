import { beforeEach, describe, expect, test } from 'vitest';
import { mergeCards, syncProfile } from '@/data/sync';
import { DuoDB, openProfileDb } from '@/data/db';
import { loadAll, recordReview } from '@/data/repo';
import { createFakeBackend, FAKE_PASSWORD } from '@/data/backend/fake';
import { newCard, rateCard } from '@/domain/fsrs';
import { computeStreak, dailyActivity } from '@/domain/streak';
import type { Backend } from '@/data/backend/types';
import type { SessionItem } from '@/domain/sessionBuilder';

const t0 = new Date(2026, 10, 16, 12, 0);
const later = (min: number) => new Date(t0.getTime() + min * 60_000);
const item = (w: string, isNew = true): SessionItem => ({ cardId: `${w}:de_en`, wordId: w, direction: 'de_en', isNew });

let n = 0;
let cloud: Backend;
let pid: string;
const device = () => new DuoDB(`sync-dev-${++n}`);

beforeEach(async () => {
  localStorage.clear();
  cloud = createFakeBackend();
  await cloud.signIn(FAKE_PASSWORD);
  pid = (await cloud.fetchProfiles())[0].id;
});

describe('mergeCards', () => {
  const local = newCard('a', 'de_en', t0);
  const remote = { ...rateCard(local, 3, later(1)), dirty: 0 as const };
  test('remote newer wins', () => expect(mergeCards(local, remote)).toEqual(remote));
  test('local newer keeps local', () => expect(mergeCards(rateCard(local, 3, later(2)), remote)).toBeNull());
  test('equal keeps local', () => expect(mergeCards(remote, remote)).toBeNull());
  test('missing local takes remote', () => expect(mergeCards(undefined, remote)).toEqual(remote));
});

describe('syncProfile', () => {
  test('pushes unsynced reviews and dirty cards, marks them synced/clean', async () => {
    const db = device();
    await recordReview(db, { item: item('a'), grade: 3, durationMs: 1000, now: t0, closesQueue: false });
    const r = await syncProfile(db, pid, cloud);
    expect(r.pushedReviews).toBe(1);
    expect(r.pushedCards).toBe(2); // de_en + unlocked en_de
    expect(await db.reviews.where('synced').equals(0).count()).toBe(0);
    expect(await db.cards.where('dirty').equals(1).count()).toBe(0);
  });

  test('two devices review same card offline → both end with the newer card and both reviews exactly once', async () => {
    const d1 = device();
    const d2 = device();
    await recordReview(d1, { item: item('a'), grade: 3, durationMs: 1000, now: t0, closesQueue: false });
    await syncProfile(d1, pid, cloud);
    await syncProfile(d2, pid, cloud);
    // both offline: d1 reviews at +30, d2 at +60
    await recordReview(d1, { item: item('a', false), grade: 1, durationMs: 1000, now: later(30), closesQueue: false });
    await recordReview(d2, { item: item('a', false), grade: 4, durationMs: 1000, now: later(60), closesQueue: false });
    await syncProfile(d2, pid, cloud);
    await syncProfile(d1, pid, cloud);
    await syncProfile(d2, pid, cloud);
    for (const db of [d1, d2]) {
      const { cards, reviews } = await loadAll(db);
      expect(cards.find((c) => c.id === 'a:de_en')!.updatedAt).toBe(later(60).toISOString());
      expect(reviews).toHaveLength(3);
      expect(new Set(reviews.map((r) => r.id)).size).toBe(3);
    }
  });

  test('new device pulls full history and computes the same streak', async () => {
    const d1 = device();
    for (let day = 10; day <= 15; day++) {
      await recordReview(d1, { item: item(`w${day}`), grade: 3, durationMs: 1000, now: new Date(2026, 10, day, 12), closesQueue: true });
    }
    await syncProfile(d1, pid, cloud);
    const d2 = device();
    const r = await syncProfile(d2, pid, cloud);
    expect(r.pulledReviews).toBe(6);
    const a = await loadAll(d1);
    const b = await loadAll(d2);
    expect(b.cards).toHaveLength(a.cards.length);
    const streak = (rs: typeof a.reviews) => computeStreak(dailyActivity(rs), '2026-11-16', 15);
    expect(streak(b.reviews)).toEqual(streak(a.reviews));
    expect(streak(b.reviews).current).toBe(6);
  });

  test('failed push leaves records unsynced', async () => {
    const db = device();
    await recordReview(db, { item: item('a'), grade: 3, durationMs: 1000, now: t0, closesQueue: false });
    const broken: Backend = { ...cloud, pushReviews: async () => { throw new Error('offline'); } };
    await expect(syncProfile(db, pid, broken)).rejects.toThrow('offline');
    expect(await db.reviews.where('synced').equals(0).count()).toBe(1);
  });

  test('card changed during push stays dirty', async () => {
    const db = device();
    await recordReview(db, { item: item('a'), grade: 3, durationMs: 1000, now: t0, closesQueue: false });
    const racing: Backend = {
      ...cloud,
      pushCards: async (p, cards) => {
        await cloud.pushCards(p, cards);
        // user answers the same card while the request is in flight
        await recordReview(db, { item: item('a', false), grade: 3, durationMs: 1000, now: later(5), closesQueue: false });
      },
    };
    await syncProfile(db, pid, racing);
    expect((await db.cards.get('a:de_en'))!.dirty).toBe(1);
  });

  test('second sync with nothing new transfers nothing', async () => {
    const db = device();
    await recordReview(db, { item: item('a'), grade: 3, durationMs: 1000, now: t0, closesQueue: false });
    await syncProfile(db, pid, cloud);
    const r = await syncProfile(db, pid, cloud);
    expect(r).toEqual({ pushedReviews: 0, pushedCards: 0, pulledReviews: 0, pulledCards: 0, pushedGames: 0, pulledGames: 0 });
  });

  test('pulled reviews do not overwrite local closesQueue/answer of the same id', async () => {
    const db = openProfileDb(`sync-own-${++n}`);
    const { review } = await recordReview(db, { item: item('a'), grade: 3, durationMs: 1000, answer: 'x', now: t0, closesQueue: true });
    await syncProfile(db, pid, cloud);
    expect((await db.reviews.get(review.id))!.closesQueue).toBe(true);
  });
});

describe('game sync', () => {
  test('games are pushed once and pulled on another device', async () => {
    const { recordGame } = await import('@/data/games');
    const d1 = device();
    await recordGame(d1, { level: 'berlin-1', seed: 7, won: true, stars: 3, moves: 20, par: 18, peeks: 0, peekedWordIds: [], durationMs: 1000, now: t0 });
    const r1 = await syncProfile(d1, pid, cloud);
    expect(r1.pushedGames).toBe(1);
    expect(await d1.games.where('synced').equals(0).count()).toBe(0);
    await syncProfile(d1, pid, cloud);
    const d2 = device();
    const r2 = await syncProfile(d2, pid, cloud);
    expect(r2.pulledGames).toBe(1);
    expect((await d2.games.toArray())[0]).toMatchObject({ level: 'berlin-1', seed: 7, stars: 3, synced: 1 });
  });
});
