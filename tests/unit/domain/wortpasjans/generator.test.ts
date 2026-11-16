import { describe, expect, test } from 'vitest';
import { srsRank } from '@/domain/wortpasjans/pool';
import { newCard } from '@/domain/fsrs';
import { solve } from '@/domain/wortpasjans/solver';
import { generateDeal, type WordPool } from '@/domain/wortpasjans/generator';
import { applyMove, initialState, isWon, type Deal } from '@/domain/wortpasjans/engine';
import { LEVELS, levelById } from '@/domain/wortpasjans/levels';
import { ALL_CATEGORIES } from '@/domain/wortpasjans/categories';
import { getWords } from '@/data/words';

const small: Deal = {
  seed: 1, level: 'test', slots: 1,
  categories: [
    { id: 'A', label: 'A', hint: 'a', wordIds: ['a1', 'a2'] },
    { id: 'B', label: 'B', hint: 'b', wordIds: ['b1', 'b2'] },
  ],
  columns: [['w:b1', 'cat:A'], ['w:a1'], ['w:a2', 'w:b2'], []],
  stock: ['cat:B'],
};

describe('solve', () => {
  test('finds a solution whose moves replay to a win', () => {
    const r = solve(small);
    expect(r.solvable).toBe(true);
    let s = initialState(small);
    for (const m of r.moves) s = applyMove(small, s, m);
    expect(isWon(small, s)).toBe(true);
    expect(r.par).toBe(r.moves.length);
  });
  test('reports unsolvable deals (no slots)', () => {
    expect(solve({ ...small, slots: 0 }).solvable).toBe(false);
  });
  test('gives up when the node budget is exhausted', () => {
    expect(solve(small, 1).solvable).toBe(false);
  });
});

const introOrder: WordPool = { words: getWords(), rank: (() => { const ix = new Map(getWords().map((w, i) => [w.id, i])); return (w) => ix.get(w.id)!; })() };

describe('generateDeal', () => {
  test('is deterministic for a seed', () => {
    const l = levelById('hamburg-2')!;
    expect(generateDeal(123, l, introOrder)).toEqual(generateDeal(123, l, introOrder));
    expect(generateDeal(124, l, introOrder).deal).not.toEqual(generateDeal(123, l, introOrder).deal);
  });

  test.each(LEVELS.filter((_, i) => i % 5 === 0).map((l) => l.id))('%s: sizes, unambiguity, solvable', (id) => {
    const l = levelById(id)!;
    for (const seed of [1, 2, 3]) {
      const { deal, par, moveLimit } = generateDeal(seed, l, introOrder);
      expect(deal.categories).toHaveLength(l.k);
      expect(deal.slots).toBe(l.slots);
      expect(deal.categories.every((c) => c.wordIds.length === l.n)).toBe(true);
      const all = [...deal.columns.flat(), ...deal.stock];
      expect(all).toHaveLength(l.k * (l.n + 1));
      expect(new Set(all).size).toBe(all.length);
      // no word also fits another category of the same board
      const boardCats = deal.categories.map((c) => ALL_CATEGORIES.find((x) => x.id === c.id)!);
      for (const c of deal.categories) for (const wid of c.wordIds) {
        const w = getWords().find((x) => x.id === wid)!;
        expect(boardCats.filter((bc) => bc.test(w)).map((bc) => bc.id)).toEqual([c.id]);
      }
      expect(solve(deal).solvable).toBe(true);
      expect(moveLimit).toBeGreaterThanOrEqual(par);
    }
  });

  test('levels with grammar families include at least one grammar category', () => {
    const { deal } = generateDeal(5, levelById('hamburg-1')!, introOrder);
    expect(deal.categories.some((c) => !c.id.startsWith('topic-'))).toBe(true);
  });

  test('prefers words with a lower rank (e.g. a topic full of due words gets chosen)', () => {
    const pool: WordPool = { words: getWords(), rank: (w) => (w.topic === 'food-drink' ? 0 : 100 + getWords().indexOf(w)) };
    for (const seed of [9, 10, 11]) {
      const { deal } = generateDeal(seed, levelById('berlin-1')!, pool);
      expect(deal.categories.map((c) => c.id)).toContain('topic-food-drink');
    }
  });

  test('fast enough for a phone (25 levels in well under a few seconds here)', () => {
    const t0 = performance.now();
    for (const l of LEVELS) generateDeal(42, l, introOrder);
    expect(performance.now() - t0).toBeLessThan(5000);
  });
});

describe('personal (SRS) pools', () => {
  const now = new Date(2026, 10, 16, 12);
  const studied = (count: number, dueShare: number) => {
    const ws = getWords().slice(0, count);
    return ws.map((w, i) => {
      const c = newCard(w.id, 'de_en', now, new Date(now.getTime() + (i % Math.round(1 / dueShare) === 0 ? -60_000 : 5 * 86_400_000)));
      return { ...c, fsrs: { ...c.fsrs, reps: 3, stability: i % 3 === 0 ? 3 : 20 } };
    });
  };
  test.each([40, 120, 300])('every level generates for many seeds with %i studied words', (count) => {
    const cards = studied(count, 0.25);
    const pool: WordPool = { words: getWords(), rank: srsRank(getWords(), cards, now) };
    for (const l of LEVELS) for (const seed of [1, 2, 3, 4]) expect(() => generateDeal(seed, l, pool)).not.toThrow();
  });
  test('different seeds give some variety of categories', () => {
    const pool: WordPool = { words: getWords(), rank: srsRank(getWords(), studied(120, 0.25), now) };
    const sets = new Set([1, 2, 3, 4, 5, 6, 7, 8].map((s) => generateDeal(s, levelById('wien-1')!, pool).deal.categories.map((c) => c.id).sort().join()));
    expect(sets.size).toBeGreaterThanOrEqual(3);
  });
  test('boards never use phrases or two cards that read the same', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const { deal } = generateDeal(seed, levelById('berlin-1')!, introOrder);
      const ws = deal.categories.flatMap((c) => c.wordIds).map((id) => getWords().find((w) => w.id === id)!);
      expect(ws.some((w) => w.pos === 'phrase')).toBe(false);
      expect(new Set(ws.map((w) => w.de.toLowerCase())).size).toBe(ws.length);
    }
  });
});
