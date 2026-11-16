import { useCallback, useMemo, useRef, useState } from 'react';
import { applyMove, categoryOf, initialState, isWon, legalMoves, type Deal, type GameState, type Move, type Source, type Target } from '@/domain/wortpasjans/engine';

export type Selection = Source | null;

const sameSource = (a: Source, b: Source) =>
  a.kind === b.kind && (a.kind === 'waste' || (b.kind === 'column' && a.col === b.col && a.depth === b.depth));

/** UI state of one board: tap a card then its destination, or drag it there. */
export function useBoard(deal: Deal, moveLimit: number) {
  const [state, setState] = useState<GameState>(() => initialState(deal));
  const [selected, setSelected] = useState<Selection>(null);
  const [peeked, setPeeked] = useState<string[]>([]);
  const startedAt = useRef(Date.now());

  const legal = useMemo(() => legalMoves(deal, state), [deal, state]);
  const won = isWon(deal, state);
  const lost = !won && (state.moves >= moveLimit || legal.length === 0);

  const targetsFor = useCallback(
    (src: Selection): Target[] =>
      src ? legal.filter((m): m is Extract<Move, { type: 'move' }> => m.type === 'move' && sameSource(m.from, src)).map((m) => m.to) : [],
    [legal],
  );

  const apply = (m: Move) => {
    setState((s) => applyMove(deal, s, m));
    setSelected(null);
  };

  const select = (src: Selection) => {
    if (won || lost) return;
    setSelected((cur) => (cur && src && sameSource(cur, src) ? null : src));
  };

  /** The run from a face-up card up to the top of its column, or null when it mixes categories. */
  const sourceAt = (col: number, faceUpIndex: number): Source | null => {
    const c = state.columns[col];
    const run = c.faceUp.slice(faceUpIndex);
    if (!run.length || new Set(run.map((x) => categoryOf(deal, x))).size !== 1) return null;
    return { kind: 'column', col, depth: c.faceUp.length - faceUpIndex };
  };

  /** Selects the run from a tapped face-up card up to the top of its column (only if the run is one category). */
  const selectInColumn = (col: number, faceUpIndex: number) => {
    const src = sourceAt(col, faceUpIndex);
    if (src) select(src);
  };

  /** Moves `from` to `to` if legal (used by tap-tap and by drag and drop). */
  const tryMove = (from: Source, to: Target) => {
    if (won || lost) return false;
    const ok = targetsFor(from).some((t) => t.kind === to.kind && (t.kind === 'slot' ? to.kind === 'slot' && t.slot === to.slot : to.kind === 'column' && t.col === to.col));
    if (!ok) return false;
    apply({ type: 'move', from, to });
    return true;
  };

  const moveTo = (to: Target) => (selected ? tryMove(selected, to) : false);

  const draw = () => {
    if (won || lost) return;
    if (legal.some((m) => m.type === 'draw')) apply({ type: 'draw' });
  };

  const peek = (wordId: string) => setPeeked((p) => (p.includes(wordId) ? p : [...p, wordId]));

  return {
    state,
    selected,
    won,
    lost,
    movesLeft: Math.max(0, moveLimit - state.moves),
    peeked,
    durationMs: () => Date.now() - startedAt.current,
    select,
    selectInColumn,
    sourceAt,
    tryMove,
    moveTo,
    draw,
    peek,
  };
}
