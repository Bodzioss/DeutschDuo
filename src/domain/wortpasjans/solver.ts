import { applyMove, initialState, isCategoryCard, isWon, legalMoves, type Deal, type GameState, type Move } from './engine';

const key = (s: GameState) =>
  JSON.stringify([s.columns.map((c) => [c.faceDown.length, c.faceUp]), s.stock, s.waste, s.slots, s.completed.length]);

/**
 * Order moves so that DFS finds a short, natural solution quickly:
 * slots first, then moves that turn a face-down card, then tableau moves, then drawing, then moves into empty columns.
 */
function priority(s: GameState, m: Move): number {
  if (m.type === 'draw') return 4;
  if (m.to.kind === 'slot') return m.from.kind === 'waste' ? 0 : 0.5;
  if (m.from.kind === 'column') {
    const col = s.columns[m.from.col];
    const reveals = m.from.depth === col.faceUp.length && col.faceDown.length > 0;
    if (reveals) return 1;
  }
  const target = s.columns[m.to.col];
  const empty = !target.faceDown.length && !target.faceUp.length;
  if (empty) {
    // moving a whole column (nothing under it) into another empty column is pointless
    if (m.from.kind === 'column') {
      const col = s.columns[m.from.col];
      if (m.from.depth === col.faceUp.length && !col.faceDown.length) return 99;
    }
    return m.from.kind === 'waste' && isCategoryCard(s.waste[s.waste.length - 1]) ? 3 : 5;
  }
  return m.from.kind === 'waste' ? 2 : 2.5;
}

export function solve(deal: Deal, budget = 200_000): { solvable: boolean; par: number; moves: Move[] } {
  const seen = new Set<string>();
  const path: Move[] = [];
  let nodes = 0;

  const dfs = (s: GameState): boolean => {
    if (isWon(deal, s)) return true;
    if (++nodes > budget) return false;
    const k = key(s);
    if (seen.has(k)) return false;
    seen.add(k);
    const moves = legalMoves(deal, s)
      .map((m) => ({ m, p: priority(s, m) }))
      .filter((x) => x.p < 99)
      .sort((a, b) => a.p - b.p);
    for (const { m } of moves) {
      path.push(m);
      if (dfs(applyMove(deal, s, m))) return true;
      path.pop();
      if (nodes > budget) return false;
    }
    return false;
  };

  const ok = dfs(initialState(deal));
  return { solvable: ok, par: ok ? path.length : 0, moves: ok ? [...path] : [] };
}
