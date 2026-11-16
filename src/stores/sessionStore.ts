import { create } from 'zustand';
import { buildSession, shouldRequeue, type SessionItem } from '@/domain/sessionBuilder';
import { localDay } from '@/domain/day';
import { cardId, type Grade, type Profile } from '@/domain/types';
import { openProfileDb } from '@/data/db';
import { loadAll, previewRating, recordReview } from '@/data/repo';
import { getWords } from '@/data/words';

export const MAX_CARD_MS = 60_000;
let answering = false;

type Listener = () => void;
const endListeners = new Set<Listener>();
/** Called when a session queue is emptied (used to trigger sync). */
export function onSessionEnd(fn: Listener): () => void {
  endListeners.add(fn);
  return () => endListeners.delete(fn);
}
const reviewListeners = new Set<Listener>();
/** Called after every recorded review (used for a debounced background sync, so interrupted sessions sync too). */
export function onReviewRecorded(fn: Listener): () => void {
  reviewListeners.add(fn);
  return () => reviewListeners.delete(fn);
}

interface SessionState {
  profileId: string | null;
  /** Daily goal of the profile when the session was built (snapshotted on every review). */
  goalMin: number | null;
  /** Learning day the queue was built for; a queue from another day must be rebuilt, never resumed. */
  builtForDay: string | null;
  queue: SessionItem[];
  index: number;
  shownAt: number | null;
  done: boolean;
  /** 'daily' = today's queue (can close the daily goal); 'practice' = chosen words, e.g. after a game. */
  kind: 'daily' | 'practice';
  start(profile: Profile): Promise<void>;
  /** Practice session made of the given words (DE→EN). Never counts as finishing today's queue. */
  startWords(profile: Profile, wordIds: string[]): Promise<void>;
  answer(grade: Grade, answer?: string): Promise<void>;
  reset(): void;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  profileId: null,
  goalMin: null,
  builtForDay: null,
  queue: [],
  index: 0,
  shownAt: null,
  done: false,
  kind: 'daily',

  async startWords(profile, wordIds) {
    const db = openProfileDb(profile.id);
    const ids = wordIds.map((w) => cardId(w, 'de_en'));
    const existing = await db.cards.bulkGet(ids);
    const queue: SessionItem[] = wordIds.map((w, i) => ({ cardId: ids[i], wordId: w, direction: 'de_en', isNew: !existing[i] || existing[i]!.fsrs.reps === 0 }));
    set({ kind: 'practice', profileId: profile.id, goalMin: profile.dailyGoalMin, builtForDay: localDay(new Date()), queue, index: 0, shownAt: Date.now(), done: queue.length === 0 });
  },

  async start(profile) {
    const db = openProfileDb(profile.id);
    const { cards, reviews } = await loadAll(db);
    const now = new Date();
    const today = localDay(now);
    const queue = buildSession({
      cards,
      words: getWords(),
      reviewsToday: reviews.filter((r) => r.localDay === today),
      now,
      newPerDay: profile.newPerDay,
    });
    set({ kind: 'daily', profileId: profile.id, goalMin: profile.dailyGoalMin, builtForDay: today, queue, index: 0, shownAt: Date.now(), done: queue.length === 0 });
  },

  async answer(grade, answer) {
    const { profileId, queue, index, shownAt, goalMin, kind } = get();
    const item = queue[index];
    if (!profileId || !item || answering) return; // double-tap guard
    answering = true;
    try {
    const now = new Date();
    const durationMs = Math.min(MAX_CARD_MS, Math.max(0, Date.now() - (shownAt ?? Date.now())));
    const isLast = index === queue.length - 1;

    // Decide requeue before writing, so closesQueue is part of the single review write
    // (a patch afterwards could race with a background sync that already pushed the review).
    const db = openProfileDb(profileId);
    const requeue = shouldRequeue(await previewRating(db, item, grade, now), now);
    await recordReview(db, { item, grade, durationMs, answer, now, closesQueue: kind === 'daily' && isLast && !requeue, goalMin: goalMin ?? undefined });
    reviewListeners.forEach((fn) => fn());

    const nextQueue = requeue ? [...queue, { ...item, isNew: false }] : queue;
    const done = index + 1 >= nextQueue.length;
    set({ queue: nextQueue, index: index + 1, shownAt: Date.now(), done });
    if (done) endListeners.forEach((fn) => fn());
    } finally {
      answering = false;
    }
  },

  reset() {
    set({ kind: 'daily', profileId: null, goalMin: null, builtForDay: null, queue: [], index: 0, shownAt: null, done: false });
  },
}));

/** A session may be continued only for the same profile, on the same learning day, with cards left. */
export function isResumable(s: Pick<SessionState, 'profileId' | 'builtForDay' | 'done' | 'queue' | 'index' | 'kind'>, profileId: string, now: Date): boolean {
  return s.kind === 'daily' && s.profileId === profileId && s.builtForDay === localDay(now) && !s.done && s.index < s.queue.length;
}

/**
 * What the review screen should do when opened with an intent: daily (from Heute) never resumes a practice
 * session; practice (from a game summary) resumes the open practice session.
 */
export function resolveReviewStart(
  s: Pick<SessionState, 'profileId' | 'builtForDay' | 'done' | 'queue' | 'index' | 'kind'>,
  profileId: string,
  intent: 'daily' | 'practice',
  now: Date,
): 'resume' | 'start-daily' {
  if (intent === 'practice') return s.kind === 'practice' && s.profileId === profileId && !s.done && s.index < s.queue.length ? 'resume' : 'start-daily';
  return isResumable(s, profileId, now) ? 'resume' : 'start-daily';
}
