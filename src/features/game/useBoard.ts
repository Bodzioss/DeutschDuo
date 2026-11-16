import { useCallback, useMemo, useRef, useState } from 'react';
import { applyMove, categoryOf, initialState, isWon, legalMoves, type Deal, type GameState, type Move, type Source, type Target } from '@/domain/wortpasjans/engine';

export type Selection = Source | null;

const sameSource = (a: Source, b: Source) =>
  a.kind === b.kind && (a.kind === 'waste' || (b.kind === 'column' && a.col === b.col && a.depth === b.depth));

/** UI state of one board: tap a card to select it, tap a highlighted target to move. */
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

  /** Selects the run from a tapped face-up card up to the top of its column (only if the run is one category). */
  const selectInColumn = (col: number, faceUpIndex: number) => {
    const c = state.columns[col];
    const depth = c.faceUp.length - faceUpIndex;
    const run = c.faceUp.slice(faceUpIndex);
    if (new Set(run.map((x) => categoryOf(deal, x))).size !== 1) return;
    select({ kind: 'column', col, depth });
  };

  const moveTo = (to: Target) => {
    if (!selected) return false;
    const ok = targetsFor(selected).some((t) => t.kind === to.kind && (t.kind === 'slot' ? to.kind === 'slot' && t.slot === to.slot : to.kind === 'column' && t.col === to.col));
    if (!ok) return false;
    apply({ type: 'move', from: selected, to });
    return true;
  };

  const draw = () => {
    if (won || lost) return;
    if (legal.some((m) => m.type === 'draw')) apply({ type: 'draw' });
  };

  const peek = (wordId: string) => setPeeked((p) => (p.includes(wordId) ? p : [...p, wordId]));

  return {
    state,
    selected,
    targets: targetsFor(selected),
    won,
    lost,
    movesLeft: Math.max(0, moveLimit - state.moves),
    peeked,
    durationMs: () => Date.now() - startedAt.current,
    select,
    selectInColumn,
    moveTo,
    draw,
    peek,
  };
}
