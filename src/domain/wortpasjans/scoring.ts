import { LEVELS } from './levels';

export const FREE_PEEKS = 3;
const PEEKS_PER_STAR = 2;
const PAR_SLACK = 1.2;

export function stars(r: { won: boolean; moves: number; par: number; peeks: number }): 0 | 1 | 2 | 3 {
  if (!r.won) return 0;
  let s = 3;
  if (r.moves > r.par * PAR_SLACK) s -= 1;
  s -= Math.floor(Math.max(0, r.peeks - FREE_PEEKS) / PEEKS_PER_STAR);
  return Math.max(1, s) as 1 | 2 | 3;
}

export type BestStars = Record<string, number>;

export function bestStarsByLevel(games: { level: string; stars: number }[]): BestStars {
  const out: BestStars = {};
  for (const g of games) out[g.level] = Math.max(out[g.level] ?? 0, g.stars);
  return out;
}

/** The first board is always open; every other opens once the previous board was won (≥ 1 star). */
export function isUnlocked(levelId: string, best: BestStars): boolean {
  const i = LEVELS.findIndex((l) => l.id === levelId);
  if (i <= 0) return i === 0;
  return (best[LEVELS[i - 1].id] ?? 0) > 0;
}

/** The board to suggest next: the first unlocked board not yet won (or the last board when all are won). */
export function nextBoard(best: BestStars): string {
  return (LEVELS.find((l) => isUnlocked(l.id, best) && !(best[l.id] > 0)) ?? LEVELS[LEVELS.length - 1]).id;
}
