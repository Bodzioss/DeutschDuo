import { useEffect } from 'react';
import { backend, BackendError } from './backend';
import type { Backend } from './backend/types';
import { openProfileDb } from './db';
import { syncProfile } from './sync';
import { onReviewRecorded, onSessionEnd } from '@/stores/sessionStore';

const INTERVAL_MS = 5 * 60_000;
/** Sync this long after the last answered card (so an interrupted session is backed up quickly). */
const REVIEW_DEBOUNCE_MS = 3_000;
export const SIGNED_OUT_EVENT = 'duo:signed-out';

/**
 * One sync at a time per profile. A trigger that arrives while that profile is syncing schedules exactly one
 * more run afterwards (so reviews made during a sync are not left waiting for the next timer).
 */
export function createSyncScheduler(run: (profileId: string) => Promise<void>) {
  const inFlight = new Map<string, Promise<void>>();
  const again = new Set<string>();

  const start = (id: string): Promise<void> => {
    const p = (async () => {
      do {
        again.delete(id);
        await run(id);
      } while (again.has(id));
    })().finally(() => inFlight.delete(id));
    inFlight.set(id, p);
    return p;
  };

  return (id: string): Promise<void> => {
    const cur = inFlight.get(id);
    if (cur) {
      again.add(id);
      return cur;
    }
    return start(id);
  };
}

/**
 * Reaction to a failed sync. Only a session the server definitively rejects signs the device out;
 * offline/transient failures (incl. a token refresh that failed on a flaky network) keep it signed in.
 */
export async function handleSyncError(e: unknown, b: Pick<Backend, 'recoverSession' | 'signOut'>): Promise<'kept' | 'signed_out'> {
  if (!(e instanceof BackendError) || e.code !== 'unauthorized') return 'kept';
  if (await b.recoverSession()) return 'kept';
  await b.signOut();
  return 'signed_out';
}

export const syncNow = createSyncScheduler(async (profileId) => {
  try {
    await syncProfile(openProfileDb(profileId), profileId, backend);
  } catch (e) {
    console.warn('sync skipped', e);
    if ((await handleSyncError(e, backend)) === 'signed_out') window.dispatchEvent(new Event(SIGNED_OUT_EVENT));
  }
});

/**
 * Background sync for the current profile: on start, after a session, when back online/visible, and every 5 min.
 * Partner profiles are pulled too (read-only on this device) so the league and duels work offline from the last sync.
 */
export function useSync(profileId: string | null, partnerIds: string[] = []): void {
  const partners = partnerIds.join(',');
  useEffect(() => {
    if (!profileId) return;
    const run = () => {
      if (navigator.onLine === false) return;
      void syncNow(profileId).then(() => Promise.all(partners.split(',').filter(Boolean).map((id) => syncNow(id))));
    };
    run();
    const offEnd = onSessionEnd(run);
    let debounce: ReturnType<typeof setTimeout> | undefined;
    const offReview = onReviewRecorded(() => {
      clearTimeout(debounce);
      debounce = setTimeout(run, REVIEW_DEBOUNCE_MS);
    });
    const onVisible = () => document.visibilityState === 'visible' && run();
    window.addEventListener('online', run);
    document.addEventListener('visibilitychange', onVisible);
    const timer = setInterval(() => document.visibilityState === 'visible' && run(), INTERVAL_MS);
    return () => {
      offEnd();
      offReview();
      clearTimeout(debounce);
      window.removeEventListener('online', run);
      document.removeEventListener('visibilitychange', onVisible);
      clearInterval(timer);
    };
  }, [profileId, partners]);
}
