import { localDay } from '@/domain/day';
import { cardId, type GameRecord } from '@/domain/types';
import type { DuoDB } from './db';

export async function recordGame(
  db: DuoDB,
  g: Omit<GameRecord, 'id' | 'synced' | 'localDay' | 'playedAt'> & { now: Date },
): Promise<GameRecord> {
  const { now, ...rest } = g;
  const rec: GameRecord = { ...rest, id: crypto.randomUUID(), playedAt: now.toISOString(), localDay: localDay(now), synced: 0 };
  await db.games.add(rec);
  return rec;
}

export const loadGames = (db: DuoDB): Promise<GameRecord[]> => db.games.toArray();

/** A peeked word comes back sooner: its DE→EN card becomes due now. Words never studied are left alone. */
export async function peekWord(db: DuoDB, wordId: string, now: Date): Promise<void> {
  await db.transaction('rw', db.cards, async () => {
    const c = await db.cards.get(cardId(wordId, 'de_en'));
    if (!c || c.fsrs.reps === 0) return;
    const prev = Date.parse(c.updatedAt);
    const stamp = now.getTime() >= prev ? now : new Date(prev + 1);
    await db.cards.put({ ...c, fsrs: { ...c.fsrs, due: now.toISOString() }, updatedAt: stamp.toISOString(), dirty: 1 });
  });
}

const duelKey = (day: string) => `duelStarted:${day}`;

/**
 * Marks today's duel as started on this device. Returns false when it had already been started: the board was seen,
 * so any later attempt is practice, not the duel (prevents studying the fixed board before the scored try).
 */
export async function markDuelStarted(db: DuoDB, day: string): Promise<boolean> {
  return db.transaction('rw', db.meta, async () => {
    if (await db.meta.get(duelKey(day))) return false;
    await db.meta.put({ key: duelKey(day), value: new Date().toISOString() });
    return true;
  });
}

export async function isDuelStarted(db: DuoDB, day: string): Promise<boolean> {
  return !!(await db.meta.get(duelKey(day)));
}
