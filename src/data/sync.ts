import type { CardRecord, ReviewRecord } from '@/domain/types';
import type { Backend, Cursor } from './backend/types';
import { getMeta, setMeta, type DuoDB } from './db';

/** Push batch size (keeps each request small on mobile networks). Pull correctness does not depend on it. */
export const BATCH = 100;

/** Card to store locally after seeing `remote`, or null when the local copy is newer or equal (last write wins). */
export function mergeCards(local: CardRecord | undefined, remote: CardRecord): CardRecord | null {
  if (local && local.updatedAt >= remote.updatedAt) return null;
  return { ...remote, dirty: 0 };
}

export interface SyncResult {
  pushedReviews: number;
  pushedCards: number;
  pulledReviews: number;
  pulledCards: number;
  pushedGames: number;
  pulledGames: number;
}

/** Push local changes, then pull everything new from the cloud. Throws on network errors (caller retries later). */
export async function syncProfile(db: DuoDB, profileId: string, b: Backend): Promise<SyncResult> {
  const result: SyncResult = { pushedReviews: 0, pushedCards: 0, pulledReviews: 0, pulledCards: 0, pushedGames: 0, pulledGames: 0 };

  // 1. reviews (append-only, idempotent by id)
  const unsynced = await db.reviews.where('synced').equals(0).toArray();
  for (let i = 0; i < unsynced.length; i += BATCH) {
    const batch = unsynced.slice(i, i + BATCH);
    await b.pushReviews(profileId, batch);
    await db.reviews.bulkUpdate(batch.map((r) => ({ key: r.id, changes: { synced: 1 as const } })));
    result.pushedReviews += batch.length;
  }

  // 2. dirty cards; clear the flag only if the card did not change while the request was in flight
  const dirty = await db.cards.where('dirty').equals(1).toArray();
  for (let i = 0; i < dirty.length; i += BATCH) {
    const batch = dirty.slice(i, i + BATCH);
    await b.pushCards(profileId, batch);
    await db.transaction('rw', db.cards, async () => {
      for (const sent of batch) {
        const cur = await db.cards.get(sent.id);
        if (cur && cur.updatedAt === sent.updatedAt) await db.cards.update(sent.id, { dirty: 0 });
      }
    });
    result.pushedCards += batch.length;
  }

  // 3. pull cards
  const cardsPull = await b.pullCards(profileId, (await getMeta<Cursor>(db, 'cardsCursor')) ?? null);
  await db.transaction('rw', db.cards, db.meta, async () => {
    for (const remote of cardsPull.rows) {
      const merged = mergeCards(await db.cards.get(remote.id), remote);
      if (merged) {
        await db.cards.put(merged);
        result.pulledCards++;
      }
    }
    await setMeta(db, 'cardsCursor', cardsPull.cursor);
  });

  // 4. pull reviews — never overwrite a local row (it may carry fields set after the push)
  const reviewsPull = await b.pullReviews(profileId, (await getMeta<Cursor>(db, 'reviewsCursor')) ?? null);
  await db.transaction('rw', db.reviews, db.meta, async () => {
    const existing = await db.reviews.bulkGet(reviewsPull.rows.map((r) => r.id));
    const fresh: ReviewRecord[] = reviewsPull.rows.filter((_, i) => !existing[i]).map((r) => ({ ...r, synced: 1 }));
    await db.reviews.bulkAdd(fresh);
    result.pulledReviews += fresh.length;
    await setMeta(db, 'reviewsCursor', reviewsPull.cursor);
  });

  // 5. games (append-only, like reviews)
  const unsyncedGames = await db.games.where('synced').equals(0).toArray();
  for (let i = 0; i < unsyncedGames.length; i += BATCH) {
    const batch = unsyncedGames.slice(i, i + BATCH);
    await b.pushGames(profileId, batch);
    await db.games.bulkUpdate(batch.map((g) => ({ key: g.id, changes: { synced: 1 as const } })));
    result.pushedGames += batch.length;
  }
  const gamesPull = await b.pullGames(profileId, (await getMeta<Cursor>(db, 'gamesCursor')) ?? null);
  await db.transaction('rw', db.games, db.meta, async () => {
    const existing = await db.games.bulkGet(gamesPull.rows.map((g) => g.id));
    const fresh = gamesPull.rows.filter((_, i) => !existing[i]).map((g) => ({ ...g, synced: 1 as const }));
    await db.games.bulkAdd(fresh);
    result.pulledGames += fresh.length;
    await setMeta(db, 'gamesCursor', gamesPull.cursor);
  });

  return result;
}
