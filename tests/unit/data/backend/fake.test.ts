import { beforeEach, describe, expect, test } from 'vitest';
import { createFakeBackend, FAKE_PASSWORD } from '@/data/backend/fake';
import { newCard, rateCard } from '@/domain/fsrs';
import type { ReviewRecord } from '@/domain/types';
import type { Backend } from '@/data/backend/types';

const now = new Date(2026, 10, 16, 12, 0);
const review = (id: string): ReviewRecord => ({
  id, cardId: 'a:de_en', rating: 3, durationMs: 1000, reviewedAt: now.toISOString(), localDay: '2026-11-16',
  wasNew: true, closesQueue: false, scheduledDays: 0, synced: 0,
});

let b: Backend;
beforeEach(async () => {
  localStorage.clear();
  b = createFakeBackend();
});

describe('fake backend', () => {
  test('signIn with wrong password throws bad_password', async () => {
    await expect(b.signIn('nope')).rejects.toThrow('bad_password');
    expect(await b.isSignedIn()).toBe(false);
  });
  test('signIn with the pair password; profiles Nikola and Marcin', async () => {
    await b.signIn(FAKE_PASSWORD);
    expect(await b.isSignedIn()).toBe(true);
    expect((await b.fetchProfiles()).map((p) => p.displayName)).toEqual(['Nikola', 'Marcin']);
  });
  test('calls before signIn are rejected', async () => {
    await expect(b.fetchProfiles()).rejects.toThrow('unauthorized');
  });
  test('pushReviews twice with same id stores one row', async () => {
    await b.signIn(FAKE_PASSWORD);
    const [p] = await b.fetchProfiles();
    await b.pushReviews(p.id, [review('r1')]);
    await b.pushReviews(p.id, [review('r1'), review('r2')]);
    expect((await b.pullReviews(p.id, null)).rows.map((r) => r.id).sort()).toEqual(['r1', 'r2']);
  });
  test('pushCards ignores older updatedAt', async () => {
    await b.signIn(FAKE_PASSWORD);
    const [p] = await b.fetchProfiles();
    const older = newCard('a', 'de_en', now);
    const newer = rateCard(older, 3, new Date(now.getTime() + 60_000));
    await b.pushCards(p.id, [newer]);
    await b.pushCards(p.id, [older]);
    const { rows } = await b.pullCards(p.id, null);
    expect(rows).toHaveLength(1);
    expect(rows[0].updatedAt).toBe(newer.updatedAt);
    expect(rows[0].dirty).toBe(0);
  });
  test('pullCards since cursor returns only newer', async () => {
    await b.signIn(FAKE_PASSWORD);
    const [p] = await b.fetchProfiles();
    await b.pushCards(p.id, [newCard('a', 'de_en', now)]);
    const first = await b.pullCards(p.id, null);
    await b.pushCards(p.id, [newCard('b', 'de_en', now)]);
    const second = await b.pullCards(p.id, first.cursor);
    expect(second.rows.map((c) => c.wordId)).toContain('b');
    // nothing new: at most the overlap window of already-seen rows is re-delivered
    const third = await b.pullCards(p.id, second.cursor);
    expect(third.rows.every((c) => ['a', 'b'].includes(c.wordId))).toBe(true);
    expect(third.cursor).toBe(second.cursor);
  });
  test('cloud persists across backend instances (new phone)', async () => {
    await b.signIn(FAKE_PASSWORD);
    const [p] = await b.fetchProfiles();
    await b.pushReviews(p.id, [review('r1')]);
    localStorage.removeItem('duo-fake-session');
    const other = createFakeBackend();
    await other.signIn(FAKE_PASSWORD);
    expect((await other.pullReviews(p.id, null)).rows).toHaveLength(1);
  });
  test('updateProfile persists settings', async () => {
    await b.signIn(FAKE_PASSWORD);
    const [p] = await b.fetchProfiles();
    await b.updateProfile({ ...p, newPerDay: 15 });
    expect((await b.fetchProfiles())[0].newPerDay).toBe(15);
  });
});
