import { backend, backendConfigError } from '@/data/backend';

export type PushState = 'unsupported' | 'ios-not-installed' | 'denied' | 'off' | 'on';

export interface PushEnv {
  ua: string;
  standalone: boolean;
  hasPush: boolean;
  permission: NotificationPermission | 'n/a';
  subscribed: boolean;
}

/** This build can send pushes: a real backend and a VAPID public key. The fake build (dev, e2e) cannot. */
export function pushAvailable(): boolean {
  const env = import.meta.env;
  return env.VITE_BACKEND !== 'fake' && !backendConfigError && !!env.VITE_VAPID_PUBLIC_KEY;
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true || !!window.matchMedia?.('(display-mode: standalone)').matches;
}

function hasPushApi(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

/** Synchronous part of the environment (subscription unknown → false). */
function syncEnv(): PushEnv {
  const hasPush = hasPushApi();
  return {
    ua: typeof navigator === 'undefined' ? '' : navigator.userAgent,
    standalone: isStandalone(),
    hasPush,
    permission: hasPush ? Notification.permission : 'n/a',
    subscribed: false,
  };
}

async function currentSubscription(): Promise<PushSubscription | null> {
  if (!hasPushApi()) return null;
  const reg = await navigator.serviceWorker.getRegistration();
  return (await reg?.pushManager.getSubscription()) ?? null;
}

/** Full environment, including whether this device holds a push subscription. */
export async function readPushEnv(): Promise<PushEnv> {
  const env = syncEnv();
  try {
    env.subscribed = !!(await currentSubscription());
  } catch {
    env.subscribed = false;
  }
  return env;
}

/** Pure over `env`. */
export function pushState(env: PushEnv = syncEnv()): PushState {
  if (/iPhone|iPad|iPod/.test(env.ua) && !env.standalone) return 'ios-not-installed';
  if (!env.hasPush) return 'unsupported';
  if (env.permission === 'denied') return 'denied';
  if (env.subscribed) return 'on';
  return 'off';
}

/** VAPID keys are base64url without padding; PushManager wants the raw bytes. */
export function urlBase64ToUint8Array(s: string): Uint8Array<ArrayBuffer> {
  const b64 = (s + '='.repeat((4 - (s.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function save(profileId: string, sub: PushSubscription): Promise<void> {
  const { endpoint, keys } = sub.toJSON();
  if (!endpoint || !keys?.p256dh || !keys.auth) throw new Error('push subscription without keys');
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  await backend.savePushSubscription(profileId, { endpoint, p256dh: keys.p256dh, auth: keys.auth, tz });
}

/**
 * Must be called straight from a click handler: iOS only shows the permission prompt inside a user gesture,
 * so requestPermission() is the first await.
 */
export async function enablePush(profileId: string): Promise<PushState> {
  const permission = await Notification.requestPermission();
  if (permission === 'denied') return 'denied';
  if (permission !== 'granted') return 'off';
  const reg = await navigator.serviceWorker.ready;
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(import.meta.env.VITE_VAPID_PUBLIC_KEY ?? '') }));
  await save(profileId, sub);
  return 'on';
}

/** Stops pushes to this device: removes the server row (best effort) and the browser subscription. */
export async function disablePush(): Promise<void> {
  try {
    if (!pushAvailable()) return;
    const sub = await currentSubscription();
    if (!sub) return;
    try {
      await backend.deletePushSubscription(sub.endpoint);
    } catch {
      /* offline: the server drops dead endpoints on the next 404/410 */
    }
    await sub.unsubscribe();
  } catch (e) {
    console.warn('push disable failed', e);
  }
}

/** On app start / profile switch: re-save the existing subscription (moves it to this profile, refreshes tz). Never throws. */
export async function refreshPushSubscription(profileId: string): Promise<void> {
  try {
    if (!pushAvailable() || !hasPushApi() || Notification.permission !== 'granted') return;
    const sub = await currentSubscription();
    if (sub) await save(profileId, sub);
  } catch (e) {
    console.warn('push refresh failed', e);
  }
}
