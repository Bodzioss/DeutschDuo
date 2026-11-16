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

function pickBoard(level: LevelDef, pool: WordPool, rnd: () => number): { cat: Category; words: Word[] }[] | null {
  const eligible = categoriesForLevel(level, pool.words);
  const jitter = new Map(pool.words.map((w) => [w.id, rnd()]));
  const score = (w: Word) => pool.rank(w) + (jitter.get(w.id) ?? 0);
  const needGrammar = level.families.some((f) => f !== 'topic');

  for (let attempt = 0; attempt < MAX_PICK_TRIES; attempt++) {
    // categories ranked by how "preferred" their best n words are, with randomness so boards vary
    const ranked = shuffle(eligible, rnd)
      .map((c) => {
        const best = pool.words.filter(c.test).map(score).sort((a, b) => a - b).slice(0, level.n);
        return { c, s: best.reduce((a, b) => a + b, 0) / level.n + rnd() * 50 };
      })
      .sort((a, b) => a.s - b.s)
      .map((x) => x.c);

    let chosen = ranked.slice(0, level.k);
    if (needGrammar && chosen.every((c) => c.family === 'topic')) {
      const g = ranked.find((c) => c.family !== 'topic');
      if (g) chosen = [...chosen.slice(0, level.k - 1), g];
    }

    const used = new Set<string>();
    const result: { cat: Category; words: Word[] }[] = [];
    for (const cat of chosen) {
      const words = pool.words
        .filter((w) => !used.has(w.id) && cat.test(w) && chosen.every((o) => o === cat || !o.test(w)))
        .sort((a, b) => score(a) - score(b))
        .slice(0, level.n);
      if (words.length < level.n) break;
      words.forEach((w) => used.add(w.id));
      result.push({ cat, words });
    }
    if (result.length === level.k) return result;
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
