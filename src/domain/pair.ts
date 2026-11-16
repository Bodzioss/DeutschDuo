import { addDays } from './day';
import { dailyActivity, isGoalMet, type DayActivity } from './streak';
import type { GameRecord, ReviewRecord } from './types';
import { LEVELS } from './wortpasjans/levels';

// ---------- week ----------

const dayIndex = (day: string) => Math.round(Date.UTC(+day.slice(0, 4), +day.slice(5, 7) - 1, +day.slice(8, 10)) / 86_400_000);

/** Monday of the week containing `day` (learning days, YYYY-MM-DD). */
export function weekStart(day: string): string {
  const dow = (dayIndex(day) + 3) % 7; // 1970-01-01 was a Thursday → Monday = 0
  return addDays(day, -dow);
}

export function weekDays(today: string): string[] {
  const out: string[] = [];
  for (let d = weekStart(today); d <= today; d = addDays(d, 1)) out.push(d);
  return out;
}

// ---------- xp & goal ----------

export const reviewXp = (r: ReviewRecord) => (r.rating === 1 ? 0 : r.cardId.endsWith(':en_de') ? 2 : 1);
export const gameXp = (g: GameRecord) => g.stars * 3;
export const DUEL_WIN_XP = 10;

export function dayGoalPct(a: DayActivity | undefined, fallbackGoalMin: number): number {
  if (!a) return 0;
  if (a.queueClosed) return 1;
  return Math.min(1, a.minutes / (a.goalMin ?? fallbackGoalMin));
}

/** Mean daily goal % from Monday; today counts only once the player has started (so mornings don't hurt). */
export function weekGoalPct(activity: Map<string, DayActivity>, today: string, fallbackGoalMin: number): number {
  const days = weekDays(today).filter((d) => d !== today || (activity.get(d)?.minutes ?? 0) > 0 || activity.get(d)?.queueClosed);
  if (!days.length) return 0;
  return days.reduce((s, d) => s + dayGoalPct(activity.get(d), fallbackGoalMin), 0) / days.length;
}

// ---------- duel ----------

/** Berlin–München boards: the duel stays short and readable. */
export const DUEL_LEVELS = LEVELS.slice(0, 15).map((l) => l.id);

export function duelForDay(day: string): { seed: number; levelId: string } {
  const n = dayIndex(day);
  return { seed: (Math.imul(n, 2654435761) >>> 0) % 2_000_000_000, levelId: DUEL_LEVELS[((n % 15) + 15) % 15] };
}

/** The first duel game a player finished on that day (later attempts are practice). */
export function duelGameOf(games: GameRecord[], day: string): GameRecord | undefined {
  return games.filter((g) => g.duelDay === day).sort((a, b) => a.playedAt.localeCompare(b.playedAt))[0];
}

/** won > fewer moves > shorter time > fewer peeks; null until both played. */
export function duelWinner(a: GameRecord | undefined, b: GameRecord | undefined): 'a' | 'b' | 'draw' | null {
  if (!a || !b) return null;
  const keys: [number, number][] = [
    [Number(b.won), Number(a.won)],
    [a.moves, b.moves],
    [a.durationMs, b.durationMs],
    [a.peeks, b.peeks],
  ];
  for (const [x, y] of keys) if (x !== y) return x < y ? 'a' : 'b';
  return 'draw';
}

// ---------- standings ----------

export interface Player {
  profileId: string;
  name: string;
  goalMin: number;
  reviews: ReviewRecord[];
  games: GameRecord[];
}

export interface Standing {
  profileId: string;
  name: string;
  goalPct: number;
  xp: number;
  daysMet: number;
  reviews: number;
  duelWins: number;
}

export function standings(players: Player[], today: string): Standing[] {
  const days = weekDays(today);
  const inWeek = (d: string) => d >= days[0] && d <= today;
  const rows = players.map((p) => {
    const activity = dailyActivity(p.reviews);
    const weekReviews = p.reviews.filter((r) => inWeek(r.localDay));
    let duelWins = 0;
    for (const d of days) {
      const mine = duelGameOf(p.games, d);
      for (const o of players) if (o !== p && duelWinner(mine, duelGameOf(o.games, d)) === 'a') duelWins++;
    }
    return {
      profileId: p.profileId,
      name: p.name,
      goalPct: weekGoalPct(activity, today, p.goalMin),
      xp:
        weekReviews.reduce((s, r) => s + reviewXp(r), 0) +
        p.games.filter((g) => inWeek(g.localDay)).reduce((s, g) => s + gameXp(g), 0) +
        duelWins * DUEL_WIN_XP,
      daysMet: days.filter((d) => isGoalMet(activity.get(d), p.goalMin)).length,
      reviews: weekReviews.length,
      duelWins,
    };
  });
  return rows.sort((a, b) => b.goalPct - a.goalPct || b.xp - a.xp);
}

// ---------- pair streak & joint goal ----------

/** Consecutive days (up to yesterday, plus today if both already made it) on which both met their goal. */
export function pairStreak(a: Map<string, DayActivity>, b: Map<string, DayActivity>, today: string, goalA: number, goalB: number): number {
  const both = (d: string) => isGoalMet(a.get(d), goalA) && isGoalMet(b.get(d), goalB);
  let n = 0;
  for (let d = addDays(today, -1); both(d); d = addDays(d, -1)) n++;
  return n + (both(today) ? 1 : 0);
}

export const JOINT_WEEKLY_REVIEWS = 300;
