import { createClient, isAuthRetryableFetchError, type SupabaseClient } from '@supabase/supabase-js';
import type { CardRecord, Direction, FsrsState, GameRecord, Grade, Profile, ReviewRecord } from '@/domain/types';
import { BackendError, type Backend, type Cursor } from './types';

const PAGE = 1000;
/**
 * Sequence numbers can commit out of order (a transaction that took seq S may commit after S+n is visible).
 * Each pull therefore also re-reads rows whose server-side changed_at is within this window before the newest
 * change already seen. Any transaction shorter than the window is covered. Merges are idempotent.
 */
export const SAFETY_WINDOW_MS = 2 * 60_000;

/** Cursor = "<max seq seen>|<max changed_at seen>" (older plain-number cursors are still accepted). */
export function makeCursor(seq: number, changedAt: string | null): string {
  return changedAt ? `${seq}|${changedAt}` : String(seq);
}

export function parseCursor(c: Cursor): { seq: number; changedAfter: string | null } {
  if (!c) return { seq: 0, changedAfter: null };
  const [seq, at] = c.split('|');
  return {
    seq: Number(seq) || 0,
    changedAfter: at ? new Date(Date.parse(at) - SAFETY_WINDOW_MS).toISOString() : null,
  };
}

type ProfileRow = { id: string; display_name: string; daily_goal_min: number; new_per_day: number; show_pl: boolean };
type CardRow = { card_id: string; word_id: string; direction: Direction; fsrs: FsrsState; updated_at: string; server_seq: number; changed_at: string };
type ReviewRow = {
  id: string; card_id: string; rating: Grade; duration_ms: number; reviewed_at: string; local_day: string;
  was_new: boolean; closes_queue: boolean; scheduled_days: number; answer: string | null; goal_min: number | null; server_seq: number; changed_at: string;
};

type GameRow = {
  id: string; level: string; seed: number; won: boolean; stars: number; moves: number; par: number; peeks: number;
  peeked_word_ids: string[]; duration_ms: number; played_at: string; local_day: string; server_seq: number; changed_at: string;
};
const toGame = (r: GameRow): GameRecord => ({
  id: r.id, level: r.level, seed: r.seed, won: r.won, stars: r.stars, moves: r.moves, par: r.par, peeks: r.peeks,
  peekedWordIds: r.peeked_word_ids ?? [], durationMs: r.duration_ms, playedAt: new Date(r.played_at).toISOString(), localDay: r.local_day, synced: 1,
});

const toProfile = (r: ProfileRow): Profile => ({
  id: r.id, displayName: r.display_name, dailyGoalMin: r.daily_goal_min, newPerDay: r.new_per_day, showPl: r.show_pl,
});
const toCard = (r: CardRow): CardRecord => ({
  id: r.card_id, wordId: r.word_id, direction: r.direction, fsrs: r.fsrs, updatedAt: new Date(r.updated_at).toISOString(), dirty: 0,
});
const toReview = (r: ReviewRow): ReviewRecord => {
  const out: ReviewRecord = {
    id: r.id, cardId: r.card_id, rating: r.rating, durationMs: r.duration_ms, reviewedAt: new Date(r.reviewed_at).toISOString(),
    localDay: r.local_day, wasNew: r.was_new, closesQueue: r.closes_queue, scheduledDays: r.scheduled_days, synced: 1,
  };
  if (r.answer !== null) out.answer = r.answer;
  if (r.goal_min !== null && r.goal_min !== undefined) out.goalMin = r.goal_min;
  return out;
};

const STORAGE_KEY = 'duo-auth';

/** True when a refreshable session is stored on the device. Purely local: never refreshes, so it works offline. */
export function hasStoredSession(raw: string | null): boolean {
  if (!raw) return false;
  try {
    const s = JSON.parse(raw);
    return typeof s?.refresh_token === 'string' && s.refresh_token.length > 0;
  } catch {
    return false;
  }
}

type ErrLike = { message?: string; status?: number; code?: string } | null | undefined;

export function classifyError(e: ErrLike): 'bad_password' | 'offline' | 'unauthorized' | 'other' {
  const msg = e?.message ?? '';
  if (/invalid login credentials/i.test(msg)) return 'bad_password';
  if (/failed to fetch|networkerror|network request failed|load failed/i.test(msg) || e?.status === 0) return 'offline';
  if (e?.code === '42501' || e?.code === 'PGRST301' || e?.code === 'PGRST303' || e?.status === 401 || /permission denied|jwt/i.test(msg)) {
    return 'unauthorized';
  }
  return 'other';
}

function fail(e: ErrLike): never {
  const kind = classifyError(e);
  if (kind === 'other') throw new Error(e?.message || 'backend error');
  throw new BackendError(kind);
}

export function createSupabaseBackend(url: string, anonKey: string, pairEmail: string): Backend {
  const sb: SupabaseClient = createClient(url, anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, storageKey: STORAGE_KEY },
  });

  async function pull<R extends { server_seq: number; changed_at: string }>(table: string, cols: string, profileId: string, since: Cursor) {
    const { seq, changedAfter } = parseCursor(since);
    const rows: R[] = [];
    let pageAfter = -1; // keyset pagination over server_seq inside the (seq OR time-window) filter
    for (;;) {
      let q = sb.from(table).select(`${cols}, server_seq, changed_at`).eq('profile_id', profileId);
      q = changedAfter ? q.or(`server_seq.gt.${seq},changed_at.gt."${changedAfter}"`) : q.gt('server_seq', seq);
      const { data, error } = await q.gt('server_seq', pageAfter).order('server_seq').limit(PAGE);
      if (error) fail(error);
      const page = (data ?? []) as unknown as R[];
      rows.push(...page);
      if (page.length < PAGE) break;
      pageAfter = page[page.length - 1].server_seq;
    }
    const prevAt = since?.split('|')[1] ?? null;
    const maxSeq = rows.reduce((m, r) => Math.max(m, Number(r.server_seq)), seq);
    const maxAt = rows.reduce<string | null>((m, r) => {
      const at = new Date(r.changed_at).toISOString();
      return !m || at > m ? at : m;
    }, prevAt);
    return { rows, cursor: maxSeq || maxAt ? makeCursor(maxSeq, maxAt) : since };
  }

  return {
    async signIn(password) {
      let res;
      try {
        res = await sb.auth.signInWithPassword({ email: pairEmail, password });
      } catch (e) {
        // fetch itself threw: no network
        if (e instanceof TypeError) throw new BackendError('offline');
        throw e;
      }
      if (res.error) fail(res.error);
    },
    async isSignedIn() {
      // Never call getSession() here: offline it fails to refresh an expired token and reports "no session".
      return hasStoredSession(localStorage.getItem(STORAGE_KEY));
    },
    async recoverSession() {
      try {
        const { data, error } = await sb.auth.refreshSession();
        if (data.session) return true;
        // network trouble while refreshing is not a reason to drop a valid refresh token
        return !!error && (isAuthRetryableFetchError(error) || classifyError(error) === 'offline');
      } catch {
        return true;
      }
    },
    async signOut() {
      await sb.auth.signOut({ scope: 'local' });
    },
    async fetchProfiles() {
      const { data, error } = await sb.from('profiles').select('id, display_name, daily_goal_min, new_per_day, show_pl').order('created_at');
      if (error) fail(error);
      return (data as ProfileRow[]).map(toProfile);
    },
    async updateProfile(p) {
      const { error } = await sb
        .from('profiles')
        .update({ display_name: p.displayName, daily_goal_min: p.dailyGoalMin, new_per_day: p.newPerDay, show_pl: p.showPl })
        .eq('id', p.id);
      if (error) fail(error);
    },
    async pushReviews(profileId, reviews) {
      if (!reviews.length) return;
      const rows = reviews.map((r) => ({
        id: r.id, profile_id: profileId, card_id: r.cardId, rating: r.rating, duration_ms: r.durationMs, reviewed_at: r.reviewedAt,
        local_day: r.localDay, was_new: r.wasNew, closes_queue: r.closesQueue, scheduled_days: r.scheduledDays, answer: r.answer ?? null, goal_min: r.goalMin ?? null,
      }));
      const { error } = await sb.from('reviews').upsert(rows, { onConflict: 'id', ignoreDuplicates: true });
      if (error) fail(error);
    },
    async pushCards(profileId, cards) {
      if (!cards.length) return;
      const p_cards = cards.map((c) => ({ card_id: c.id, word_id: c.wordId, direction: c.direction, fsrs: c.fsrs, updated_at: c.updatedAt }));
      const { error } = await sb.rpc('upsert_cards', { p_profile: profileId, p_cards });
      if (error) fail(error);
    },
    async pullReviews(profileId, since) {
      const r = await pull<ReviewRow>(
        'reviews',
        'id, card_id, rating, duration_ms, reviewed_at, local_day, was_new, closes_queue, scheduled_days, answer, goal_min',
        profileId,
        since,
      );
      return { rows: r.rows.map(toReview), cursor: r.cursor };
    },
    async pushGames(profileId, games) {
      if (!games.length) return;
      const rows = games.map((g) => ({
        id: g.id, profile_id: profileId, level: g.level, seed: g.seed, won: g.won, stars: g.stars, moves: g.moves, par: g.par,
        peeks: g.peeks, peeked_word_ids: g.peekedWordIds, duration_ms: g.durationMs, played_at: g.playedAt, local_day: g.localDay,
      }));
      const { error } = await sb.from('game_sessions').upsert(rows, { onConflict: 'id', ignoreDuplicates: true });
      if (error) fail(error);
    },
    async pullGames(profileId, since) {
      const r = await pull<GameRow>(
        'game_sessions',
        'id, level, seed, won, stars, moves, par, peeks, peeked_word_ids, duration_ms, played_at, local_day',
        profileId,
        since,
      );
      return { rows: r.rows.map(toGame), cursor: r.cursor };
    },
    async pullCards(profileId, since) {
      const r = await pull<CardRow>('user_cards', 'card_id, word_id, direction, fsrs, updated_at', profileId, since);
      return { rows: r.rows.map(toCard), cursor: r.cursor };
    },
  };
}
