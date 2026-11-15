import { beforeEach, describe, expect, test } from 'vitest';
import { openProfileDb, deleteProfileDb } from '@/data/db';
import { loadAll, recordReview } from '@/data/repo';
import type { SessionItem } from '@/domain/sessionBuilder';

const now = new Date(2026, 10, 16, 21, 0);
const item: SessionItem = { cardId: 'der-tisch:de_en', wordId: 'der-tisch', direction: 'de_en', isNew: true };
let pid = 0;
let db: ReturnType<typeof openProfileDb>;

beforeEach(() => {
  db = openProfileDb(`test-${++pid}`);
});

describe('recordReview', () => {
  test('creates card for new item and stores review with wasNew true', async () => {
    const { card, review } = await recordReview(db, { item, grade: 3, durationMs: 4000, now, closesQueue: false });
    expect(card.fsrs.reps).toBe(1);
    expect(review.wasNew).toBe(true);
    expect(review.synced).toBe(0);
    expect(review.scheduledDays).toBe(card.fsrs.scheduled_days);
    const all = await loadAll(db);
    expect(all.cards.map((c) => c.id)).toContain('der-tisch:de_en');
    expect(all.reviews).toHaveLength(1);
  });
  test('Good on de_en unlocks en_de due at next 03:00', async () => {
    const { unlocked } = await recordReview(db, { item, grade: 3, durationMs: 1, now, closesQueue: false });
    expect(unlocked?.id).toBe('der-tisch:en_de');
    expect(unlocked?.fsrs.due).toBe(new Date(2026, 10, 17, 3, 0).toISOString());
    expect(await db.cards.get('der-tisch:en_de')).toBeDefined();
  });
  test('Again on de_en does not unlock', async () => {
    const { unlocked } = await recordReview(db, { item, grade: 1, durationMs: 1, now, closesQueue: false });
    expect(unlocked).toBeUndefined();
    expect(await db.cards.get('der-tisch:en_de')).toBeUndefined();
  });
  test('second Good does not create duplicate en_de', async () => {
    await recordReview(db, { item, grade: 3, durationMs: 1, now, closesQueue: false });
    const later = new Date(now.getTime() + 60_000);
    const r = await recordReview(db, { item: { ...item, isNew: false }, grade: 3, durationMs: 1, now: later, closesQueue: false });
    expect(r.unlocked).toBeUndefined();
    expect(r.review.wasNew).toBe(false);
    expect(await db.cards.count()).toBe(2);
  });
  test('review gets localDay from now', async () => {
    const late = new Date(2026, 10, 17, 1, 30);
    const { review } = await recordReview(db, { item, grade: 3, durationMs: 1, now: late, closesQueue: true });
    expect(review.localDay).toBe('2026-11-16');
    expect(review.closesQueue).toBe(true);
  });
  test('profiles are isolated', async () => {
    const a = openProfileDb('iso-a');
    const b = openProfileDb('iso-b');
    await recordReview(a, { item, grade: 3, durationMs: 1, now, closesQueue: false });
    expect(await b.reviews.count()).toBe(0);
    await deleteProfileDb('iso-a');
    await deleteProfileDb('iso-b');
  });
});

describe('previewRating', () => {
  test('returns the card recordReview will store, without writing anything', async () => {
    const { previewRating } = await import('@/data/repo');
    const preview = await previewRating(db, item, 3, now);
    expect(await db.cards.count()).toBe(0);
    const { card } = await recordReview(db, { item, grade: 3, durationMs: 1, now, closesQueue: false });
    expect(preview.fsrs.due).toBe(card.fsrs.due);
  });
});
