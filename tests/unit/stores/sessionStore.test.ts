import { beforeEach, describe, expect, test } from 'vitest';
import { useSessionStore } from '@/stores/sessionStore';
import { openProfileDb } from '@/data/db';
import type { Profile } from '@/domain/types';

let n = 0;
let profile: Profile;
beforeEach(async () => {
  profile = { id: `sess-${++n}`, displayName: 'T', dailyGoalMin: 15, newPerDay: 2, showPl: true };
  await useSessionStore.getState().start(profile);
});

describe('sessionStore', () => {
  test('starts with 2 new words', () => {
    const s = useSessionStore.getState();
    expect(s.queue).toHaveLength(2);
    expect(s.done).toBe(false);
  });
  test('Again requeues card at the end', async () => {
    const first = useSessionStore.getState().queue[0];
    await useSessionStore.getState().answer(1);
    const s = useSessionStore.getState();
    expect(s.queue).toHaveLength(3);
    expect(s.queue[2].cardId).toBe(first.cardId);
    expect(s.index).toBe(1);
  });
  test('last answer sets closesQueue true and done true', async () => {
    await useSessionStore.getState().answer(4);
    await useSessionStore.getState().answer(4);
    expect(useSessionStore.getState().done).toBe(true);
    const reviews = await openProfileDb(profile.id).reviews.toArray();
    expect(reviews).toHaveLength(2);
    expect(reviews.filter((r) => r.closesQueue)).toHaveLength(1);
    expect(reviews.find((r) => r.closesQueue)!.reviewedAt >= reviews.find((r) => !r.closesQueue)!.reviewedAt).toBe(true);
  });
  test('durationMs capped at 60000', async () => {
    useSessionStore.setState({ shownAt: Date.now() - 120_000 });
    await useSessionStore.getState().answer(4);
    const [r] = await openProfileDb(profile.id).reviews.toArray();
    expect(r.durationMs).toBe(60_000);
  });
  test('restarting the same day resumes without re-adding introduced words', async () => {
    await useSessionStore.getState().answer(4);
    await useSessionStore.getState().start(profile);
    expect(useSessionStore.getState().queue).toHaveLength(1);
  });
});

describe('sessionStore writes', () => {
  test('closesQueue is part of the original review write (never patched afterwards)', async () => {
    const db = openProfileDb(profile.id);
    const updates: unknown[] = [];
    db.reviews.hook('updating', (mods) => {
      updates.push(mods);
    });
    await useSessionStore.getState().answer(4);
    await useSessionStore.getState().answer(4);
    expect(updates).toEqual([]);
  });
});
