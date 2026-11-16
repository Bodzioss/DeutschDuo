import type { Word } from '../types';
import { categoriesForLevel, type Category } from './categories';
import type { Deal } from './engine';
import type { LevelDef } from './levels';
import { mulberry32, shuffle } from './rng';
import { solve } from './solver';

/** Words the board may use; lower rank = preferred (personal SRS order for solo, introduction order for duels). */
export interface WordPool {
  words: Word[];
  rank(w: Word): number;
}

const MAX_SEED_TRIES = 30;
const MAX_PICK_TRIES = 40;

/** 4 tableau columns, staircase sizes; about 60% of the cards start on the tableau. */
function columnSizes(total: number): number[] {
  const onTableau = Math.min(14, Math.round(total * 0.6));
  const base = Math.floor(onTableau / 4);
  const extra = onTableau % 4;
  return [0, 1, 2, 3].map((j) => base + (j >= 4 - extra ? 1 : 0));
}

/** Words that can appear on a board: no phrases or multi-word entries (they make huge cards). */
const playable = (w: Word) => w.pos !== 'phrase' && !w.de.includes(' ');

/**
 * Words of `cat` that fit no other category of `set`, best first; homographs ("sein" verb / "sein" his) are skipped
 * so that two cards never read the same.
 */
function exclusiveWords(cat: Category, set: Category[], words: Word[], used: Set<string>, usedDe: Set<string>): Word[] {
  return words.filter((w) => !used.has(w.id) && !usedDe.has(w.de.toLowerCase()) && cat.test(w) && set.every((o) => o === cat || !o.test(w)));
}

function pickBoard(level: LevelDef, pool: WordPool, rnd: () => number): { cat: Category; words: Word[] }[] | null {
  const candidates = pool.words.filter(playable);
  const eligible = categoriesForLevel(level, candidates);
  // Ranks can be huge (SRS buckets) — use ordinal positions so the randomness below actually matters.
  const byPref = [...candidates].sort((a, b) => pool.rank(a) - pool.rank(b));
  const ordinal = new Map(byPref.map((w, i) => [w.id, i + rnd() * 25]));
  const ordered = [...candidates].sort((a, b) => ordinal.get(a.id)! - ordinal.get(b.id)!);
  const needGrammar = level.families.some((f) => f !== 'topic');

  for (let attempt = 0; attempt < MAX_PICK_TRIES; attempt++) {
    const ranked = shuffle(eligible, rnd)
      .map((c) => {
        const best = ordered.filter(c.test).slice(0, level.n).map((w) => ordinal.get(w.id)!);
        return { c, s: best.reduce((a, b) => a + b, 0) / level.n + rnd() * 120 };
      })
      .sort((a, b) => a.s - b.s)
      .map((x) => x.c);
    if (needGrammar) {
      const g = ranked.findIndex((c) => c.family !== 'topic');
      if (g > 0) ranked.unshift(...ranked.splice(g, 1));
    }

    // Greedy: add a category only if every category of the set still has n exclusive words.
    const set: Category[] = [];
    for (const c of ranked) {
      if (set.length === level.k) break;
      const trial = [...set, c];
      const used = new Set<string>();
      const usedDe = new Set<string>();
      const ok = trial.every((cat) => {
        const ws = exclusiveWords(cat, trial, ordered, used, usedDe).slice(0, level.n);
        ws.forEach((w) => (used.add(w.id), usedDe.add(w.de.toLowerCase())));
        return ws.length === level.n;
      });
      if (ok) set.push(c);
    }
    if (set.length < level.k) continue;

    const used = new Set<string>();
    const usedDe = new Set<string>();
    return set.map((cat) => {
      const words = exclusiveWords(cat, set, ordered, used, usedDe).slice(0, level.n);
      words.forEach((w) => (used.add(w.id), usedDe.add(w.de.toLowerCase())));
      return { cat, words };
    });
  }
  return null;
}

export function generateDeal(seed: number, level: LevelDef, pool: WordPool): { deal: Deal; par: number; moveLimit: number } {
  for (let t = 0; t < MAX_SEED_TRIES; t++) {
    const used = seed + t;
    const rnd = mulberry32(used);
    const board = pickBoard(level, pool, rnd);
    if (!board) continue;

    const cards = shuffle(
      board.flatMap(({ cat, words }) => [`cat:${cat.id}`, ...words.map((w) => `w:${w.id}`)]),
      rnd,
    );
    const sizes = columnSizes(cards.length);
    const columns: string[][] = [];
    let i = 0;
    for (const n of sizes) {
      columns.push(cards.slice(i, i + n));
      i += n;
    }
    const deal: Deal = {
      seed: used,
      level: level.id,
      slots: level.slots,
      categories: board.map(({ cat, words }) => ({ id: cat.id, label: cat.label, hint: cat.hint, wordIds: words.map((w) => w.id) })),
      columns,
      stock: cards.slice(i),
    };
    const sol = solve(deal);
    if (sol.solvable) return { deal, par: sol.par, moveLimit: Math.ceil(sol.par * 1.5) + 5 };
  }
  throw new Error(`no solvable deal for ${level.id} near seed ${seed}`);
}
