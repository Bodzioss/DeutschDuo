import { useEffect, useState } from 'react';
import { liveQuery } from 'dexie';
import type { Player } from '@/domain/pair';
import type { Profile } from '@/domain/types';
import { openProfileDb } from '@/data/db';
import { useProfileStore } from '@/stores/profileStore';

/** Reviews and games of every profile of the pair, live from the local DBs (partners are pulled by background sync). */
export function usePairData(): Player[] | null {
  const profiles = useProfileStore((s) => s.profiles);
  const [players, setPlayers] = useState<Player[] | null>(null);
  const key = profiles.map((p) => `${p.id}:${p.dailyGoalMin}:${p.displayName}`).join('|');

  useEffect(() => {
    if (!profiles.length) return;
    const load = async (ps: Profile[]) =>
      Promise.all(
        ps.map(async (p) => {
          const db = openProfileDb(p.id);
          const [reviews, games] = await Promise.all([db.reviews.toArray(), db.games.toArray()]);
          return { profileId: p.id, name: p.displayName, goalMin: p.dailyGoalMin, reviews, games } satisfies Player;
        }),
      );
    const sub = liveQuery(() => load(profiles)).subscribe({ next: setPlayers, error: (e) => console.error('pair data failed', e) });
    return () => sub.unsubscribe();
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  return players;
}
