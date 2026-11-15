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
}

export function computeToday(p: { cards: CardRecord[]; reviews: ReviewRecord[]; words: Word[]; profile: Profile; now: Date }): TodaySummary {
  const today = localDay(p.now);
  const reviewsToday = p.reviews.filter((r) => r.localDay === today);
  const session = buildSession({ cards: p.cards, words: p.words, reviewsToday, now: p.now, newPerDay: p.profile.newPerDay });
  const activity = dailyActivity(p.reviews);
  const streak = computeStreak(activity, today, p.profile.dailyGoalMin);
  return {
    dueCount: session.filter((i) => !i.isNew).length,
    newCount: session.filter((i) => i.isNew).length,
    minutesToday: activity.get(today)?.minutes ?? 0,
    goalMin: p.profile.dailyGoalMin,
    goalMet: isGoalMet(activity.get(today), p.profile.dailyGoalMin),
    streak: streak.current,
    freezes: streak.freezes,
  };
}

/** Live summary of today's state for the given profile (re-computes on every local DB change). */
export function useToday(profile: Profile | null): TodaySummary | null {
  const [summary, setSummary] = useState<TodaySummary | null>(null);
  useEffect(() => {
    if (!profile) return;
    const sub = liveQuery(() => loadAll(openProfileDb(profile.id))).subscribe({
      next: ({ cards, reviews }) => setSummary(computeToday({ cards, reviews, words: getWords(), profile, now: new Date() })),
      error: (e) => console.error('today query failed', e),
    });
    return () => sub.unsubscribe();
  }, [profile]);
  return summary;
}
