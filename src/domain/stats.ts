import { addDays } from './day';
import type { DayActivity } from './streak';
import type { CardRecord, ReviewRecord } from './types';

export const KNOWN_DAYS = 7;

/** For each day: number of words with any card whose latest review (≤ day) scheduled ≥ 7 days. */
export function knownOverTime(reviews: ReviewRecord[], days: string[]): { day: string; known: number }[] {
  const sorted = [...reviews].sort((a, b) => a.reviewedAt.localeCompare(b.reviewedAt));
  const lastByCard = new Map<string, number>();
  let i = 0;
  return days.map((day) => {
    while (i < sorted.length && sorted[i].localDay <= day) {
      lastByCard.set(sorted[i].cardId, sorted[i].scheduledDays);
      i++;
    }
    const words = new Set<string>();
    for (const [cardId, sd] of lastByCard) if (sd >= KNOWN_DAYS) words.add(cardId.split(':')[0]);
    return { day, known: words.size };
  });
}

export function retention30d(reviews: ReviewRecord[], today: string): number | null {
  const from = addDays(today, -30);
  const rel = reviews.filter((r) => !r.wasNew && r.localDay > from && r.localDay <= today);
  if (rel.length === 0) return null;
  return rel.filter((r) => r.rating !== 1).length / rel.length;
}

export function minutesPerDay(activity: Map<string, DayActivity>, days: string[]): number[] {
  return days.map((d) => activity.get(d)?.minutes ?? 0);
}

export function hardestWords(cards: CardRecord[], n = 10): { wordId: string; lapses: number }[] {
  const sum = new Map<string, number>();
  for (const c of cards) sum.set(c.wordId, (sum.get(c.wordId) ?? 0) + c.fsrs.lapses);
  return [...sum]
    .filter(([, l]) => l > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, n)
    .map(([wordId, lapses]) => ({ wordId, lapses }));
}
