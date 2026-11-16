import type { Player } from '@/domain/pair';
import type { Profile } from '@/domain/types';
import { openProfileDb } from './db';

/** Reviews and games of each profile, read from the local DBs, in the shape the league domain wants. */
export function loadPlayers(profiles: Profile[]): Promise<Player[]> {
  return Promise.all(
    profiles.map(async (p) => {
      const db = openProfileDb(p.id);
      const [reviews, games] = await Promise.all([db.reviews.toArray(), db.games.toArray()]);
      return { profileId: p.id, name: p.displayName, goalMin: p.dailyGoalMin, reviews, games } satisfies Player;
    }),
  );
}
