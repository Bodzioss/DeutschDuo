import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { CardRecord, Direction, FsrsState, Grade, Profile, ReviewRecord } from '@/domain/types';
import { BackendError, type Backend, type Cursor } from './types';

const PAGE = 1000;
/** Re-read a small window behind the cursor: sequence values can commit out of order. Merges are idempotent. */
const OVERLAP = 200;

type ProfileRow = { id: string; display_name: string; daily_goal_min: number; new_per_day: number; show_pl: boolean };
type CardRow = { card_id: string; word_id: string; direction: Direction; fsrs: FsrsState; updated_at: string; server_seq: number };
type ReviewRow = {
  id: string; card_id: string; rating: Grade; duration_ms: number; reviewed_at: string; local_day: string;
  was_new: boolean; closes_queue: boolean; scheduled_days: number; answer: string | null; server_seq: number;
};

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
  return out;
};

function fail(e: { message?: string; status?: number } | null | undefined): never {
  const msg = e?.message ?? '';
  if (/invalid login credentials/i.test(msg)) throw new BackendError('bad_password');
  if (/fetch|network|load failed/i.test(msg) || e?.status === 0) throw new BackendError('offline');
  if (e?.status === 401 || /jwt/i.test(msg)) throw new BackendError('unauthorized');
  throw new Error(msg || 'backend error');
}

export function createSupabaseBackend(url: string, anonKey: string, pairEmail: string): Backend {
  const sb: SupabaseClient = createClient(url, anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, storageKey: 'duo-auth' },
  });

  async function pull<R extends { server_seq: number }>(table: string, cols: string, profileId: string, since: Cursor) {
    const rows: R[] = [];
    let from = Math.max(0, Number(since ?? 0) - OVERLAP);
    for (;;) {
      const { data, error } = await sb.from(table).select(cols).eq('profile_id', profileId).gt('server_seq', from).order('server_seq').limit(PAGE);
      if (error) fail(error);
      const page = (data ?? []) as unknown as R[];
      rows.push(...page);
      if (page.length < PAGE) break;
      from = page[page.length - 1].server_seq;
    }
    const max = rows.reduce((m, r) => Math.max(m, r.server_seq), Number(since ?? 0));
    return { rows, cursor: max ? String(max) : since };
  }

  return {
    async signIn(password) {
      try {
        const { error } = await sb.auth.signInWithPassword({ email: pairEmail, password });
        if (error) fail(error);
      } catch (e) {
        if (e instanceof BackendError) throw e;
        throw new BackendError('offline');
      }
    },
    async isSignedIn() {
      const { data } = await sb.auth.getSession();
      return !!data.session;
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
        local_day: r.localDay, was_new: r.wasNew, closes_queue: r.closesQueue, scheduled_days: r.scheduledDays, answer: r.answer ?? null,
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
        'id, card_id, rating, duration_ms, reviewed_at, local_day, was_new, closes_queue, scheduled_days, answer, server_seq',
        profileId,
        since,
      );
      return { rows: r.rows.map(toReview), cursor: r.cursor };
    },
    async pullCards(profileId, since) {
      const r = await pull<CardRow>('user_cards', 'card_id, word_id, direction, fsrs, updated_at, server_seq', profileId, since);
      return { rows: r.rows.map(toCard), cursor: r.cursor };
    },
  };
}
