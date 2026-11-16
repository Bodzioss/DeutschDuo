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
export type SyncStatus = 'ok' | 'error' | 'signed_out';

export function createSyncScheduler<R = void>(run: (profileId: string) => Promise<R>) {
  const inFlight = new Map<string, Promise<R>>();
  const again = new Set<string>();

  const start = (id: string): Promise<R> => {
    const p = (async () => {
      let r: R;
      do {
        again.delete(id);
        r = await run(id);
      } while (again.has(id));
      return r;
    })().finally(() => inFlight.delete(id));
    inFlight.set(id, p);
    return p;
  };

  return (id: string): Promise<R> => {
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

let currentProfileId: string | null = null;

/** Sync one profile. Partner profiles (not the one in use on this device) skip their card table. */
export const syncNow = createSyncScheduler<SyncStatus>(async (profileId) => {
  try {
    await syncProfile(openProfileDb(profileId), profileId, backend, { pullCards: profileId === currentProfileId });
    return 'ok';
  } catch (e) {
    console.warn('sync skipped', e);
    if ((await handleSyncError(e, backend)) === 'signed_out') {
      window.dispatchEvent(new Event(SIGNED_OUT_EVENT));
      return 'signed_out';
    }
    return 'error';
  }
});

/** Own profile first; partners only if this device is still signed in. */
export async function syncWithPartners(me: string, partners: string[], run: (id: string) => Promise<SyncStatus> = syncNow): Promise<void> {
  if ((await run(me)) === 'signed_out') return;
  for (const id of partners) if ((await run(id)) === 'signed_out') return;
}

/**
 * Background sync for the current profile: on start, after a session, when back online/visible, and every 5 min.
 * Partner profiles are pulled too (read-only on this device) so the league and duels work offline from the last sync.
 */
export function useSync(profileId: string | null, partnerIds: string[] = []): void {
  const partners = partnerIds.join(',');
  useEffect(() => {
    if (!profileId) return;
    currentProfileId = profileId;
    const partnerList = partners.split(',').filter(Boolean);
    // own data after every review burst; partners only on start, visibility, reconnect and the timer
    const runOwn = () => {
      if (navigator.onLine !== false) void syncNow(profileId);
    };
    const run = () => {
      if (navigator.onLine !== false) void syncWithPartners(profileId, partnerList);
    };
    run();
    const offEnd = onSessionEnd(runOwn);
    let debounce: ReturnType<typeof setTimeout> | undefined;
    const offReview = onReviewRecorded(() => {
      clearTimeout(debounce);
      debounce = setTimeout(runOwn, REVIEW_DEBOUNCE_MS);
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
