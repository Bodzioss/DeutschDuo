import { describe, expect, test } from 'vitest';
import { mulberry32, shuffle } from '@/domain/wortpasjans/rng';
import { LEVELS, levelById, nextLevel } from '@/domain/wortpasjans/levels';
import { ALL_CATEGORIES, categoriesForLevel } from '@/domain/wortpasjans/categories';
import { getWord, getWords } from '@/data/words';

describe('rng', () => {
  test('same seed → same sequence; different seed → different', () => {
    const a = mulberry32(42), b = mulberry32(42), c = mulberry32(43);
    const sa = [a(), a(), a()], sb = [b(), b(), b()], sc = [c(), c(), c()];
    expect(sa).toEqual(sb);
    expect(sa).not.toEqual(sc);
    expect(sa.every((x) => x >= 0 && x < 1)).toBe(true);
  });
  test('shuffle is a deterministic permutation and does not mutate input', () => {
    const xs = [1, 2, 3, 4, 5, 6, 7, 8];
    const s1 = shuffle(xs, mulberry32(7));
    expect(shuffle(xs, mulberry32(7))).toEqual(s1);
    expect([...s1].sort()).toEqual(xs);
    expect(xs).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });
});

describe('levels', () => {
  test('5 cities × 5 boards in route order', () => {
    expect(LEVELS).toHaveLength(25);
    expect(LEVELS[0].id).toBe('berlin-1');
    expect(LEVELS[24].id).toBe('zurich-5');
    expect([...new Set(LEVELS.map((l) => l.city))]).toEqual(['Berlin', 'Hamburg', 'München', 'Wien', 'Zürich']);
  });
  test('difficulty table', () => {
    expect(levelById('berlin-3')).toMatchObject({ k: 3, n: 3, slots: 3, families: ['topic'] });
    expect(levelById('hamburg-1')).toMatchObject({ k: 4, n: 3, slots: 3 });
    expect(levelById('zurich-2')).toMatchObject({ k: 5, n: 5, slots: 4 });
  });
  test('nextLevel', () => {
    expect(nextLevel('berlin-5')?.id).toBe('hamburg-1');
    expect(nextLevel('zurich-5')).toBeUndefined();
  });
});

describe('categories', () => {
  const cat = (id: string) => ALL_CATEGORIES.find((c) => c.id === id)!;
  const w = (id: string) => getWord(id)!;
  test('grammar categories match from data', () => {
    expect(cat('gender-die').test(w('die-frau'))).toBe(true);
    expect(cat('gender-die').test(w('der-tisch'))).toBe(false);
    expect(cat('plural-er').test(w('das-haus'))).toBe(true);
    expect(cat('plural-e').test(w('der-tisch'))).toBe(true);
    expect(cat('prep-dativ').test(w('mit'))).toBe(true);
    expect(cat('prep-akk').test(w('mit'))).toBe(false);
    expect(cat('verbs-trennbar').test(w('aufstehen'))).toBe(true);
    expect(cat('topic-basics').test(w('hallo'))).toBe(true);
  });
  test('plural categories ignore nouns whose plural equals the singular or is missing', () => {
    const lehrer = getWords().find((x) => x.pos === 'noun' && x.plural === x.de)!;
    expect(['plural-n', 'plural-e', 'plural-er', 'plural-s'].some((id) => cat(id).test(lehrer))).toBe(false);
  });
  test('every category has a German label and a Polish hint', () => {
    for (const c of ALL_CATEGORIES) {
      expect(c.label.length).toBeGreaterThan(0);
      expect(c.hint.length).toBeGreaterThan(0);
    }
  });
  test('categoriesForLevel respects families and has enough words for n', () => {
    expect(categoriesForLevel(levelById('berlin-1')!, getWords()).every((c) => c.id.startsWith('topic-'))).toBe(true);
    for (const l of LEVELS) {
      const cs = categoriesForLevel(l, getWords());
      expect(cs.length).toBeGreaterThanOrEqual(l.k);
      for (const c of cs) expect(getWords().filter(c.test).length).toBeGreaterThanOrEqual(l.n);
    }
  });
});
