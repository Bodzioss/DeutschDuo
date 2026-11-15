import { useEffect } from 'react';
import { backend } from './backend';
import { openProfileDb } from './db';
import { syncProfile } from './sync';
import { onSessionEnd } from '@/stores/sessionStore';

const INTERVAL_MS = 5 * 60_000;
let inFlight: Promise<void> | null = null;

/** Runs one sync at a time; network errors are logged and retried on the next trigger. */
export function syncNow(profileId: string): Promise<void> {
  if (inFlight) return inFlight;
  inFlight = syncProfile(openProfileDb(profileId), profileId, backend)
    .then(() => undefined)
    .catch((e) => console.warn('sync skipped', e))
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

/** Background sync for the current profile: on start, after a session, when back online, and every 5 min while visible. */
export function useSync(profileId: string | null): void {
  useEffect(() => {
    if (!profileId) return;
    const run = () => {
      if (navigator.onLine !== false) void syncNow(profileId);
    };
    run();
    const offEnd = onSessionEnd(run);
    const onVisible = () => document.visibilityState === 'visible' && run();
    window.addEventListener('online', run);
    document.addEventListener('visibilitychange', onVisible);
    const timer = setInterval(() => document.visibilityState === 'visible' && run(), INTERVAL_MS);
    return () => {
      offEnd();
      window.removeEventListener('online', run);
      document.removeEventListener('visibilitychange', onVisible);
      clearInterval(timer);
    };
  }, [profileId]);
}
