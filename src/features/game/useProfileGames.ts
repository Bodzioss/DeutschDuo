import { useEffect, useState } from 'react';
import { liveQuery } from 'dexie';
import type { GameRecord } from '@/domain/types';
import { openProfileDb } from '@/data/db';

/** Live list of the profile's finished boards (local + synced). */
export function useProfileGames(profileId: string | undefined): GameRecord[] | null {
  const [games, setGames] = useState<GameRecord[] | null>(null);
  useEffect(() => {
    if (!profileId) return;
    const sub = liveQuery(() => openProfileDb(profileId).games.toArray()).subscribe({
      next: setGames,
      error: (e) => console.error('games query failed', e),
    });
    return () => sub.unsubscribe();
  }, [profileId]);
  return games;
}
