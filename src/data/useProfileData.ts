import { useEffect, useState } from 'react';
import { liveQuery } from 'dexie';
import type { CardRecord, ReviewRecord } from '@/domain/types';
import { openProfileDb } from './db';
import { loadAll } from './repo';

/** Live cards + reviews of a profile (updates on every local DB change, incl. sync). */
export function useProfileData(profileId: string | undefined): { cards: CardRecord[]; reviews: ReviewRecord[] } | null {
  const [data, setData] = useState<{ cards: CardRecord[]; reviews: ReviewRecord[] } | null>(null);
  useEffect(() => {
    if (!profileId) return;
    const sub = liveQuery(() => loadAll(openProfileDb(profileId))).subscribe({
      next: setData,
      error: (e) => console.error('profile data query failed', e),
    });
    return () => sub.unsubscribe();
  }, [profileId]);
  return data;
}
