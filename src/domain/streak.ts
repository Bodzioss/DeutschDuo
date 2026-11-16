import { addDays } from './day';
import type { ReviewRecord } from './types';

export interface DayActivity {
  day: string;
  reviews: number;
  newWords: number;
  minutes: number;
  queueClosed: boolean;
  /** Smallest goal snapshot of the day's reviews (undefined for legacy reviews without one). */
  goalMin?: number;
}

export const MAX_FREEZES = 2;
export const FREEZE_EVERY = 7;

export function dailyActivity(reviews: ReviewRecord[]): Map<string, DayActivity> {
  const m = new Map<string, DayActivity>();
  for (const r of reviews) {
    let a = m.get(r.localDay);
    if (!a) m.set(r.localDay, (a = { day: r.localDay, reviews: 0, newWords: 0, minutes: 0, queueClosed: false }));
    a.reviews += 1;
    if (r.wasNew && r.cardId.endsWith(':de_en')) a.newWords += 1;
    a.minutes += r.durationMs / 60000;
    if (r.closesQueue) a.queueClosed = true;
    if (r.goalMin !== undefined) a.goalMin = a.goalMin === undefined ? r.goalMin : Math.min(a.goalMin, r.goalMin);
  }
  return m;
}

/** `fallbackGoalMin` applies only to days whose reviews carry no goal snapshot (older data). */
export function isGoalMet(a: DayActivity | undefined, fallbackGoalMin: number): boolean {
  return !!a && (a.minutes >= (a.goalMin ?? fallbackGoalMin) || a.queueClosed);
}

export function computeStreak(
  activity: Map<string, DayActivity>,
  today: string,
  goalMin: number,
): { current: number; freezes: number; todayMet: boolean; frozenDays: string[] } {
  let streak = 0;
  let freezes = 0;
  const frozenDays: string[] = [];
  const days = [...activity.keys()].filter((d) => d < today).sort();

  if (days.length) {
    for (let d = days[0]; d < today; d = addDays(d, 1)) {
      if (isGoalMet(activity.get(d), goalMin)) {
        streak += 1;
        if (streak % FREEZE_EVERY === 0) freezes = Math.min(MAX_FREEZES, freezes + 1);
      } else if (streak > 0 && freezes > 0) {
        freezes -= 1;
        frozenDays.push(d);
      } else {
        streak = 0;
      }
    }
  }

  const todayMet = isGoalMet(activity.get(today), goalMin);
  if (todayMet && (streak + 1) % FREEZE_EVERY === 0) freezes = Math.min(MAX_FREEZES, freezes + 1);
  return { current: streak + (todayMet ? 1 : 0), freezes, todayMet, frozenDays };
}
