import Dexie, { type Table } from 'dexie';
import type { CardRecord, GameRecord, Profile, ReviewRecord } from '@/domain/types';

export interface MetaRow {
  key: string;
  value: unknown;
}

/** Local progress of a single profile. */
export class DuoDB extends Dexie {
  cards!: Table<CardRecord, string>;
  reviews!: Table<ReviewRecord, string>;
  meta!: Table<MetaRow, string>;
  games!: Table<GameRecord, string>;

  constructor(name: string) {
    super(name);
    this.version(1).stores({
      cards: '&id, wordId, dirty',
      reviews: '&id, localDay, synced, cardId',
      meta: '&key',
    });
    this.version(2).stores({ games: '&id, level, synced, localDay' });
  }
}

const cache = new Map<string, DuoDB>();
const dbName = (profileId: string) => `duo-${profileId}`;

export function openProfileDb(profileId: string): DuoDB {
  let db = cache.get(profileId);
  if (!db) cache.set(profileId, (db = new DuoDB(dbName(profileId))));
  return db;
}

export async function deleteProfileDb(profileId: string): Promise<void> {
  cache.get(profileId)?.close();
  cache.delete(profileId);
  await Dexie.delete(dbName(profileId));
}

export async function getMeta<T>(db: DuoDB, key: string): Promise<T | undefined> {
  return (await db.meta.get(key))?.value as T | undefined;
}

export async function setMeta(db: DuoDB, key: string, value: unknown): Promise<void> {
  await db.meta.put({ key, value });
}

/** Device-wide data: cached profiles and settings (e.g. currentProfileId). */
class GlobalDB extends Dexie {
  profiles!: Table<Profile, string>;
  settings!: Table<MetaRow, string>;

  constructor() {
    super('duo-global');
    this.version(1).stores({ profiles: '&id', settings: '&key' });
  }
}

export const globalDb = new GlobalDB();
