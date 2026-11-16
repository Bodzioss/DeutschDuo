import { DEFAULT_NOTIFY, type CardRecord, type GameRecord, type Profile, type ReviewRecord } from '@/domain/types';
import { BackendError, type Backend, type Cursor } from './types';

/** In-browser stand-in for Supabase (tests, E2E, offline dev). The "cloud" lives in localStorage. */
export const FAKE_PASSWORD = 'test';
const CLOUD_KEY = 'duo-fake-cloud';
const SESSION_KEY = 'duo-fake-session';

interface Cloud {
  seq: number;
  profiles: Profile[];
  cards: Record<string, Record<string, { card: CardRecord; seq: number }>>;
  reviews: Record<string, Record<string, { review: ReviewRecord; seq: number }>>;
  games?: Record<string, Record<string, { game: GameRecord; seq: number }>>;
}

const DEFAULT_PROFILES: Profile[] = [
  { id: '00000000-0000-4000-8000-00000000000a', displayName: 'Nikola', dailyGoalMin: 15, newPerDay: 10, showPl: true, notify: DEFAULT_NOTIFY },
  { id: '00000000-0000-4000-8000-00000000000b', displayName: 'Marcin', dailyGoalMin: 15, newPerDay: 10, showPl: true, notify: DEFAULT_NOTIFY },
];

function load(): Cloud {
  const raw = localStorage.getItem(CLOUD_KEY);
  return raw ? JSON.parse(raw) : { seq: 0, profiles: DEFAULT_PROFILES, cards: {}, reviews: {} };
}
const save = (c: Cloud) => localStorage.setItem(CLOUD_KEY, JSON.stringify(c));
const toCursor = (n: number) => String(n);
/** Like the Supabase backend, re-deliver a few rows behind the cursor so callers must merge idempotently. */
const OVERLAP = 3;
const fromCursor = (c: Cursor) => (c ? Math.max(0, Number(c) - OVERLAP) : 0);

export function createFakeBackend(): Backend {
  const online = () => typeof navigator === 'undefined' || navigator.onLine !== false;
  const guard = () => {
    if (!online()) throw new BackendError('offline');
    if (localStorage.getItem(SESSION_KEY) !== '1') throw new BackendError('unauthorized');
  };

  return {
    async signIn(password) {
      if (!online()) throw new BackendError('offline');
      if (password !== FAKE_PASSWORD) throw new BackendError('bad_password');
      localStorage.setItem(SESSION_KEY, '1');
    },
    async isSignedIn() {
      return localStorage.getItem(SESSION_KEY) === '1';
    },
    async recoverSession() {
      return localStorage.getItem(SESSION_KEY) === '1';
    },
    async signOut() {
      localStorage.removeItem(SESSION_KEY);
    },
    async fetchProfiles() {
      guard();
      return load().profiles;
    },
    async updateProfile(p) {
      guard();
      const c = load();
      c.profiles = c.profiles.map((x) => (x.id === p.id ? p : x));
      save(c);
    },
    async savePushSubscription() {},
    async deletePushSubscription() {},
    async notifyPartner() {},
    async pushReviews(profileId, reviews) {
      guard();
      const c = load();
      const t = (c.reviews[profileId] ??= {});
      for (const r of reviews) if (!t[r.id]) t[r.id] = { review: { ...r, synced: 1 }, seq: ++c.seq };
      save(c);
    },
    async pushCards(profileId, cards) {
      guard();
      const c = load();
      const t = (c.cards[profileId] ??= {});
      for (const card of cards) {
        const cur = t[card.id];
        if (!cur || cur.card.updatedAt < card.updatedAt) t[card.id] = { card: { ...card, dirty: 0 }, seq: ++c.seq };
      }
      save(c);
    },
    async pullReviews(profileId, since) {
      guard();
      const c = load();
      const rows = Object.values(c.reviews[profileId] ?? {}).filter((x) => x.seq > fromCursor(since)).sort((a, b) => a.seq - b.seq);
      return { rows: rows.map((x) => x.review), cursor: rows.length ? toCursor(Math.max(Number(since ?? 0), rows[rows.length - 1].seq)) : since };
    },
    async pushGames(profileId, games) {
      guard();
      const c = load();
      const t = ((c.games ??= {})[profileId] ??= {});
      for (const g of games) if (!t[g.id]) t[g.id] = { game: { ...g, synced: 1 }, seq: ++c.seq };
      save(c);
    },
    async pullGames(profileId, since) {
      guard();
      const c = load();
      const rows = Object.values(c.games?.[profileId] ?? {}).filter((x) => x.seq > fromCursor(since)).sort((a, b) => a.seq - b.seq);
      return { rows: rows.map((x) => x.game), cursor: rows.length ? toCursor(Math.max(Number(since ?? 0), rows[rows.length - 1].seq)) : since };
    },
    async pullCards(profileId, since) {
      guard();
      const c = load();
      const rows = Object.values(c.cards[profileId] ?? {}).filter((x) => x.seq > fromCursor(since)).sort((a, b) => a.seq - b.seq);
      return { rows: rows.map((x) => x.card), cursor: rows.length ? toCursor(Math.max(Number(since ?? 0), rows[rows.length - 1].seq)) : since };
    },
  };
}
