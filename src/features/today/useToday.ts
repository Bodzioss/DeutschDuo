import { useEffect, useState } from 'react';
import { liveQuery } from 'dexie';
import { buildSession } from '@/domain/sessionBuilder';
import { localDay } from '@/domain/day';
import { computeStreak, dailyActivity, isGoalMet } from '@/domain/streak';
import type { CardRecord, Profile, ReviewRecord, Word } from '@/domain/types';
import { openProfileDb } from '@/data/db';
import { loadAll } from '@/data/repo';
import { getWords } from '@/data/words';

export interface TodaySummary {
  dueCount: number;
  newCount: number;
  minutesToday: number;
  goalMin: number;
  goalMet: boolean;
  streak: number;
  freezes: number;
  /** start: something to study now · wait: nothing due yet but today's goal is not met · done: goal met, nothing due */
  status: 'start' | 'wait' | 'done';
  /** Earliest future due time today (ISO), for "come back in N min". */
  nextDueAt: string | null;
}

export function computeToday(p: { cards: CardRecord[]; reviews: ReviewRecord[]; words: Word[]; profile: Profile; now: Date }): TodaySummary {
  const today = localDay(p.now);
  const reviewsToday = p.reviews.filter((r) => r.localDay === today);
  const session = buildSession({ cards: p.cards, words: p.words, reviewsToday, now: p.now, newPerDay: p.profile.newPerDay });
  const activity = dailyActivity(p.reviews);
  const streak = computeStreak(activity, today, p.profile.dailyGoalMin);
  const goalMet = isGoalMet(activity.get(today), p.profile.dailyGoalMin);
  const nowMs = p.now.getTime();
  const nextDueAt =
    p.cards
      .map((c) => c.fsrs.due)
      .filter((d) => Date.parse(d) > nowMs && localDay(new Date(d)) === today)
      .sort()[0] ?? null;
  return {
    status: session.length > 0 ? 'start' : goalMet ? 'done' : 'wait',
    nextDueAt,
    dueCount: session.filter((i) => !i.isNew).length,
    newCount: session.filter((i) => i.isNew).length,
    minutesToday: activity.get(today)?.minutes ?? 0,
    goalMin: p.profile.dailyGoalMin,
    goalMet,
    streak: streak.current,
    freezes: streak.freezes,
  };
}

const REFRESH_MS = 30_000;

/**
 * Live summary of today's state for the given profile. Re-computes on every local DB change, every 30 s,
 * and when the app becomes visible again (a PWA can stay in memory overnight; cards come due over time).
 */
export function useToday(profile: Profile | null): TodaySummary | null {
  const [summary, setSummary] = useState<TodaySummary | null>(null);
  useEffect(() => {
    if (!profile) return;
    let last: { cards: CardRecord[]; reviews: ReviewRecord[] } | null = null;
    const recompute = () => last && setSummary(computeToday({ ...last, words: getWords(), profile, now: new Date() }));
    const sub = liveQuery(() => loadAll(openProfileDb(profile.id))).subscribe({
      next: (data) => {
        last = data;
        recompute();
      },
      error: (e) => console.error('today query failed', e),
    });
    const timer = setInterval(recompute, REFRESH_MS);
    const onVisible = () => document.visibilityState === 'visible' && recompute();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      sub.unsubscribe();
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [profile]);
  return summary;
}
