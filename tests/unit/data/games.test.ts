import { beforeEach, describe, expect, test } from 'vitest';
import { openProfileDb } from '@/data/db';
import { loadGames, peekWord, recordGame } from '@/data/games';
import { recordReview } from '@/data/repo';

const now = new Date(2026, 10, 16, 21, 0);
let n = 0;
let db: ReturnType<typeof openProfileDb>;
beforeEach(() => {
  db = openProfileDb(`games-${++n}`);
});

describe('games', () => {
  test('recordGame stores an unsynced game with its local day', async () => {
    const g = await recordGame(db, { level: 'berlin-1', seed: 5, won: true, stars: 3, moves: 20, par: 18, peeks: 1, peekedWordIds: ['hallo'], durationMs: 60_000, now });
    expect(g.synced).toBe(0);
    expect(g.localDay).toBe('2026-11-16');
    expect((await loadGames(db)).map((x) => x.id)).toEqual([g.id]);
  });
  test('peekWord makes an existing de_en card due now', async () => {
    await recordReview(db, { item: { cardId: 'hallo:de_en', wordId: 'hallo', direction: 'de_en', isNew: true }, grade: 4, durationMs: 1, now, closesQueue: false });
    const later = new Date(now.getTime() + 60_000);
    await peekWord(db, 'hallo', later);
    const c = (await db.cards.get('hallo:de_en'))!;
    expect(c.fsrs.due).toBe(later.toISOString());
    expect(c.dirty).toBe(1);
    expect(c.updatedAt > now.toISOString()).toBe(true);
  });
  test('peekWord on a word never studied changes nothing', async () => {
    await peekWord(db, 'danke', now);
    expect(await db.cards.count()).toBe(0);
  });
});
