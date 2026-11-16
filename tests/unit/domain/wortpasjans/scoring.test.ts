import { describe, expect, test } from 'vitest';
import { FREE_PEEKS, stars, bestStarsByLevel, isUnlocked, nextBoard } from '@/domain/wortpasjans/scoring';

describe('stars', () => {
  test('a loss gives 0', () => expect(stars({ won: false, moves: 10, par: 10, peeks: 0 })).toBe(0));
  test('clean win gives 3', () => expect(stars({ won: true, moves: 12, par: 10, peeks: FREE_PEEKS })).toBe(3));
  test('more than par × 1.2 moves costs a star', () => expect(stars({ won: true, moves: 13, par: 10, peeks: 0 })).toBe(2));
  test('every 2 peeks beyond the free ones cost a star', () => {
    expect(stars({ won: true, moves: 10, par: 10, peeks: FREE_PEEKS + 1 })).toBe(3);
    expect(stars({ won: true, moves: 10, par: 10, peeks: FREE_PEEKS + 2 })).toBe(2);
    expect(stars({ won: true, moves: 10, par: 10, peeks: FREE_PEEKS + 4 })).toBe(1);
  });
  test('a win never scores below 1', () => expect(stars({ won: true, moves: 99, par: 10, peeks: 20 })).toBe(1));
});

describe('progress', () => {
  const g = (level: string, s: number) => ({ level, stars: s, won: s > 0 });
  test('best stars per level', () => {
    expect(bestStarsByLevel([g('berlin-1', 1), g('berlin-1', 3), g('berlin-2', 0)])).toEqual({ 'berlin-1': 3, 'berlin-2': 0 });
  });
  test('first board unlocked; each next unlocks after a win of the previous', () => {
    const best = bestStarsByLevel([g('berlin-1', 2)]);
    expect(isUnlocked('berlin-1', {})).toBe(true);
    expect(isUnlocked('berlin-2', {})).toBe(false);
    expect(isUnlocked('berlin-2', best)).toBe(true);
    expect(isUnlocked('berlin-3', best)).toBe(false);
  });
  test('nextBoard = first unlocked level without a win', () => {
    expect(nextBoard({})).toBe('berlin-1');
    expect(nextBoard(bestStarsByLevel([g('berlin-1', 1), g('berlin-2', 3)]))).toBe('berlin-3');
  });
});
