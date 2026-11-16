import { describe, expect, test } from 'vitest';
import { applyMove, categoryOf, initialState, isWon, legalMoves, type Deal, type GameState, type Move } from '@/domain/wortpasjans/engine';

// Category A: a1 a2 · Category B: b1 b2 · one slot
const deal: Deal = {
  seed: 1,
  level: 'test',
  slots: 1,
  categories: [
    { id: 'A', label: 'A', hint: 'a', wordIds: ['a1', 'a2'] },
    { id: 'B', label: 'B', hint: 'b', wordIds: ['b1', 'b2'] },
  ],
  // last element of a column = top (face up)
  columns: [['w:b1', 'cat:A'], ['w:a1'], ['w:a2', 'w:b2'], []],
  stock: ['cat:B'],
};
const col = (s: GameState, i: number) => s.columns[i];
const mv = (from: Move & { type: 'move' }) => from;

describe('initialState', () => {
  test('top card of each column is face up, the rest face down', () => {
    const s = initialState(deal);
    expect(col(s, 0)).toEqual({ faceDown: ['w:b1'], faceUp: ['cat:A'] });
    expect(col(s, 3)).toEqual({ faceDown: [], faceUp: [] });
    expect(s.stock).toEqual(['cat:B']);
    expect(s.waste).toEqual([]);
    expect(s.slots).toEqual([null]);
    expect(s.moves).toBe(0);
  });
  test('categoryOf', () => {
    expect(categoryOf(deal, 'cat:A')).toBe('A');
    expect(categoryOf(deal, 'w:b2')).toBe('B');
  });
});

describe('moves', () => {
  test('category card opens an empty slot; turning the next card face up', () => {
    const s = applyMove(deal, initialState(deal), mv({ type: 'move', from: { kind: 'column', col: 0, depth: 1 }, to: { kind: 'slot', slot: 0 } }));
    expect(s.slots[0]).toEqual({ categoryId: 'A', count: 0 });
    expect(col(s, 0)).toEqual({ faceDown: [], faceUp: ['w:b1'] });
    expect(s.moves).toBe(1);
  });
  test('word card onto its open slot; category completes and frees the slot', () => {
    let s = applyMove(deal, initialState(deal), mv({ type: 'move', from: { kind: 'column', col: 0, depth: 1 }, to: { kind: 'slot', slot: 0 } }));
    s = applyMove(deal, s, mv({ type: 'move', from: { kind: 'column', col: 1, depth: 1 }, to: { kind: 'slot', slot: 0 } }));
    expect(s.slots[0]).toEqual({ categoryId: 'A', count: 1 });
    expect(() => applyMove(deal, s, mv({ type: 'move', from: { kind: 'column', col: 2, depth: 1 }, to: { kind: 'slot', slot: 0 } }))).toThrow(); // b2 is B
    // a2 is under b2: move b2 to the empty column first
    s = applyMove(deal, s, mv({ type: 'move', from: { kind: 'column', col: 2, depth: 1 }, to: { kind: 'column', col: 3 } }));
    expect(col(s, 2).faceUp).toEqual(['w:a2']);
    s = applyMove(deal, s, mv({ type: 'move', from: { kind: 'column', col: 2, depth: 1 }, to: { kind: 'slot', slot: 0 } }));
    expect(s.completed).toEqual(['A']);
    expect(s.slots[0]).toBeNull();
  });
  test('word card cannot open an empty slot', () => {
    const s = initialState(deal);
    expect(() => applyMove(deal, s, mv({ type: 'move', from: { kind: 'column', col: 1, depth: 1 }, to: { kind: 'slot', slot: 0 } }))).toThrow();
  });
  test('a category card cannot go into an occupied slot', () => {
    let s = applyMove(deal, initialState(deal), mv({ type: 'move', from: { kind: 'column', col: 0, depth: 1 }, to: { kind: 'slot', slot: 0 } }));
    s = applyMove(deal, s, { type: 'draw' });
    expect(() => applyMove(deal, s, mv({ type: 'move', from: { kind: 'waste' }, to: { kind: 'slot', slot: 0 } }))).toThrow();
  });
  test('stacking on the tableau needs the same category; any card goes to an empty column', () => {
    const s = initialState(deal);
    // a1 (A) onto cat:A (A): ok
    const s1 = applyMove(deal, s, mv({ type: 'move', from: { kind: 'column', col: 1, depth: 1 }, to: { kind: 'column', col: 0 } }));
    expect(col(s1, 0).faceUp).toEqual(['cat:A', 'w:a1']);
    expect(col(s1, 1)).toEqual({ faceDown: [], faceUp: [] });
    // b2 (B) onto a1 (A): illegal
    expect(() => applyMove(deal, s1, mv({ type: 'move', from: { kind: 'column', col: 2, depth: 1 }, to: { kind: 'column', col: 0 } }))).toThrow();
    // a run of same-category cards moves together to an empty column
    const s2 = applyMove(deal, s1, mv({ type: 'move', from: { kind: 'column', col: 0, depth: 2 }, to: { kind: 'column', col: 1 } }));
    expect(col(s2, 1).faceUp).toEqual(['cat:A', 'w:a1']);
    expect(col(s2, 0).faceUp).toEqual(['w:b1']);
  });
  test('cannot move a run of mixed categories or onto the same column', () => {
    let s = initialState(deal);
    s = applyMove(deal, s, mv({ type: 'move', from: { kind: 'column', col: 2, depth: 1 }, to: { kind: 'column', col: 3 } }));
    expect(() => applyMove(deal, s, mv({ type: 'move', from: { kind: 'column', col: 0, depth: 1 }, to: { kind: 'column', col: 0 } }))).toThrow();
    expect(() => applyMove(deal, s, mv({ type: 'move', from: { kind: 'column', col: 0, depth: 2 }, to: { kind: 'column', col: 3 } }))).toThrow();
  });
  test('draw moves the stock top to the waste; an empty stock recycles the waste', () => {
    let s = applyMove(deal, initialState(deal), { type: 'draw' });
    expect(s.stock).toEqual([]);
    expect(s.waste).toEqual(['cat:B']);
    s = applyMove(deal, s, { type: 'draw' });
    expect(s.stock).toEqual(['cat:B']);
    expect(s.waste).toEqual([]);
    expect(s.moves).toBe(2);
  });
  test('applyMove does not mutate the input state', () => {
    const s = initialState(deal);
    const copy = JSON.parse(JSON.stringify(s));
    applyMove(deal, s, { type: 'draw' });
    expect(s).toEqual(copy);
  });
});

describe('legalMoves and winning', () => {
  test('legal moves are all applicable and include draw', () => {
    const s = initialState(deal);
    const ms = legalMoves(deal, s);
    expect(ms).toContainEqual({ type: 'draw' });
    for (const m of ms) expect(() => applyMove(deal, s, m)).not.toThrow();
  });
  test('a full solution wins', () => {
    const steps: Move[] = [
      { type: 'move', from: { kind: 'column', col: 0, depth: 1 }, to: { kind: 'slot', slot: 0 } }, // cat:A → slot
      { type: 'move', from: { kind: 'column', col: 1, depth: 1 }, to: { kind: 'slot', slot: 0 } }, // a1
      { type: 'move', from: { kind: 'column', col: 2, depth: 1 }, to: { kind: 'column', col: 3 } }, // b2 aside
      { type: 'move', from: { kind: 'column', col: 2, depth: 1 }, to: { kind: 'slot', slot: 0 } }, // a2 → A complete
      { type: 'draw' }, // cat:B
      { type: 'move', from: { kind: 'waste' }, to: { kind: 'slot', slot: 0 } },
      { type: 'move', from: { kind: 'column', col: 0, depth: 1 }, to: { kind: 'slot', slot: 0 } }, // b1
      { type: 'move', from: { kind: 'column', col: 3, depth: 1 }, to: { kind: 'slot', slot: 0 } }, // b2 → B complete
    ];
    let s = initialState(deal);
    for (const m of steps) s = applyMove(deal, s, m);
    expect(isWon(deal, s)).toBe(true);
    expect(s.moves).toBe(8);
  });
});
