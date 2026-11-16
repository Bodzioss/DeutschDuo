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

/** Day activity as the league sees it: the day's **highest** goal snapshot (lowering the goal late does not help). */
export type LeagueDay = DayActivity & { goalMax?: number };

export function leagueActivity(reviews: ReviewRecord[]): Map<string, LeagueDay> {
  const m = dailyActivity(reviews) as Map<string, LeagueDay>;
  for (const r of reviews) {
    const a = m.get(r.localDay)!;
    if (r.goalMin !== undefined) a.goalMax = Math.max(a.goalMax ?? 0, r.goalMin);
  }
  return m;
}

export function dayGoalPct(a: LeagueDay | undefined, fallbackGoalMin: number): number {
  if (!a) return 0;
  if (a.queueClosed) return 1;
  return Math.min(1, a.minutes / (a.goalMax ?? a.goalMin ?? fallbackGoalMin));
}

/**
 * Mean daily goal % from Monday. In a running week today counts only once the player has started (so mornings
 * don't hurt); a finished week (`complete`) counts every day, Sunday included.
 */
export function weekGoalPct(activity: Map<string, LeagueDay>, today: string, fallbackGoalMin: number, complete = false): number {
  const days = weekDays(today).filter((d) => complete || d !== today || (activity.get(d)?.minutes ?? 0) > 0 || activity.get(d)?.queueClosed);
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

/** won > fewer moves > shorter time > fewer peeks; null until both played the same board. */
export function duelWinner(a: GameRecord | undefined, b: GameRecord | undefined): 'a' | 'b' | 'draw' | null {
  if (!a || !b) return null;
  if (a.seed !== b.seed || a.level !== b.level) return null; // e.g. phones on different app versions
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
  /** goal (minutes) the player was judged against this week (highest snapshot), for transparency */
  goalMin: number;
  goalPct: number;
  xp: number;
  daysMet: number;
  reviews: number;
  duelWins: number;
}

/** Game XP: only the best result per board per day counts (replaying an easy board is not a way to farm XP). */
function bestGameXp(games: GameRecord[]): number {
  const best = new Map<string, number>();
  for (const g of games) best.set(`${g.localDay}|${g.level}`, Math.max(best.get(`${g.localDay}|${g.level}`) ?? 0, gameXp(g)));
  return [...best.values()].reduce((a, b) => a + b, 0);
}

/** Order: goal % (regularity), then days with the goal met, then XP. `complete` = the week is over (all 7 days count). */
export function standings(players: Player[], today: string, opts: { complete?: boolean } = {}): Standing[] {
  const days = weekDays(today);
  const inWeek = (d: string) => d >= days[0] && d <= today;
  const rows = players.map((p) => {
    const activity = leagueActivity(p.reviews);
    const weekReviews = p.reviews.filter((r) => inWeek(r.localDay));
    let duelWins = 0;
    for (const d of days) {
      const mine = duelGameOf(p.games, d);
      for (const o of players) if (o !== p && duelWinner(mine, duelGameOf(o.games, d)) === 'a') duelWins++;
    }
    const snapshots = weekReviews.map((r) => r.goalMin).filter((g): g is number => g !== undefined);
    return {
      profileId: p.profileId,
      name: p.name,
      goalMin: snapshots.length ? Math.max(...snapshots) : p.goalMin,
      goalPct: weekGoalPct(activity, today, p.goalMin, opts.complete),
      xp: weekReviews.reduce((s, r) => s + reviewXp(r), 0) + bestGameXp(p.games.filter((g) => inWeek(g.localDay))) + duelWins * DUEL_WIN_XP,
      daysMet: days.filter((d) => dayGoalPct(activity.get(d), p.goalMin) >= 1).length,
      reviews: weekReviews.length,
      duelWins,
    };
  });
  return rows.sort((a, b) => b.goalPct - a.goalPct || b.daysMet - a.daysMet || b.xp - a.xp);
}

/** True when the top two are exactly level (no winner to show). */
export function isTie(s: Standing[]): boolean {
  return s.length > 1 && s[0].goalPct === s[1].goalPct && s[0].daysMet === s[1].daysMet && s[0].xp === s[1].xp;
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
