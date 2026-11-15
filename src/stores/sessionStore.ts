import { create } from 'zustand';
import { buildSession, shouldRequeue, type SessionItem } from '@/domain/sessionBuilder';
import { localDay } from '@/domain/day';
import type { Grade, Profile } from '@/domain/types';
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
  /** Learning day the queue was built for; a queue from another day must be rebuilt, never resumed. */
  builtForDay: string | null;
  queue: SessionItem[];
  index: number;
  shownAt: number | null;
  done: boolean;
  start(profile: Profile): Promise<void>;
  answer(grade: Grade, answer?: string): Promise<void>;
  reset(): void;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  profileId: null,
  builtForDay: null,
  queue: [],
  index: 0,
  shownAt: null,
  done: false,

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
    set({ profileId: profile.id, builtForDay: today, queue, index: 0, shownAt: Date.now(), done: queue.length === 0 });
  },

  async answer(grade, answer) {
    const { profileId, queue, index, shownAt } = get();
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
    await recordReview(db, { item, grade, durationMs, answer, now, closesQueue: isLast && !requeue });
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
    set({ profileId: null, builtForDay: null, queue: [], index: 0, shownAt: null, done: false });
  },
}));

/** A session may be continued only for the same profile, on the same learning day, with cards left. */
export function isResumable(s: Pick<SessionState, 'profileId' | 'builtForDay' | 'done' | 'queue' | 'index'>, profileId: string, now: Date): boolean {
  return s.profileId === profileId && s.builtForDay === localDay(now) && !s.done && s.index < s.queue.length;
}
