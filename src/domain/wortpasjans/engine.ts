// Wortpasjans rules engine: pure, immutable state transitions.

export type CardId = string; // 'cat:<categoryId>' | 'w:<wordId>'

export interface DealCategory {
  id: string;
  label: string;
  hint: string;
  wordIds: string[];
}

export interface Deal {
  seed: number;
  level: string;
  categories: DealCategory[];
  /** last element of a column = top card (face up) */
  columns: CardId[][];
  /** stock[0] = next card to draw */
  stock: CardId[];
  slots: number;
}

export interface Column {
  faceDown: CardId[];
  faceUp: CardId[];
}

export interface GameState {
  columns: Column[];
  stock: CardId[];
  /** last element = playable top */
  waste: CardId[];
  slots: ({ categoryId: string; count: number } | null)[];
  completed: string[];
  moves: number;
}

/** depth = number of face-up cards taken from the top of the column */
export type Source = { kind: 'column'; col: number; depth: number } | { kind: 'waste' };
export type Target = { kind: 'column'; col: number } | { kind: 'slot'; slot: number };
export type Move = { type: 'draw' } | { type: 'move'; from: Source; to: Target };

export const isCategoryCard = (c: CardId) => c.startsWith('cat:');
export const wordIdOf = (c: CardId) => (c.startsWith('w:') ? c.slice(2) : null);

export function categoryOf(deal: Deal, card: CardId): string {
  if (isCategoryCard(card)) return card.slice(4);
  const wid = card.slice(2);
  const cat = deal.categories.find((c) => c.wordIds.includes(wid));
  if (!cat) throw new Error(`unknown card ${card}`);
  return cat.id;
}

export function initialState(deal: Deal): GameState {
  return {
    columns: deal.columns.map((c) => ({ faceDown: c.slice(0, -1), faceUp: c.slice(-1) })),
    stock: [...deal.stock],
    waste: [],
    slots: Array.from({ length: deal.slots }, () => null),
    completed: [],
    moves: 0,
  };
}

const clone = (s: GameState): GameState => ({
  columns: s.columns.map((c) => ({ faceDown: [...c.faceDown], faceUp: [...c.faceUp] })),
  stock: [...s.stock],
  waste: [...s.waste],
  slots: s.slots.map((x) => (x ? { ...x } : null)),
  completed: [...s.completed],
  moves: s.moves,
});

function takeCards(s: GameState, from: Source): CardId[] {
  if (from.kind === 'waste') return s.waste.length ? [s.waste[s.waste.length - 1]] : [];
  const col = s.columns[from.col];
  if (!col || from.depth < 1 || from.depth > col.faceUp.length) return [];
  return col.faceUp.slice(-from.depth);
}

/** Why a move is illegal, or null when it is legal. */
function check(deal: Deal, s: GameState, m: Move): string | null {
  if (m.type === 'draw') return s.stock.length || s.waste.length ? null : 'nothing to draw';
  const cards = takeCards(s, m.from);
  if (!cards.length) return 'no card at source';
  const cats = new Set(cards.map((c) => categoryOf(deal, c)));
  if (cats.size !== 1) return 'mixed run';
  const cat = [...cats][0];

  if (m.to.kind === 'slot') {
    if (cards.length !== 1) return 'only one card to a slot';
    const slot = s.slots[m.to.slot];
    if (slot === undefined) return 'no such slot';
    if (isCategoryCard(cards[0])) return slot === null ? null : 'slot occupied';
    return slot && slot.categoryId === cat ? null : 'word needs its open category';
  }

  if (m.from.kind === 'column' && m.from.col === m.to.col) return 'same column';
  const target = s.columns[m.to.col];
  if (!target) return 'no such column';
  if (!target.faceDown.length && !target.faceUp.length) return null;
  const top = target.faceUp[target.faceUp.length - 1];
  return top && categoryOf(deal, top) === cat ? null : 'different category';
}

export function applyMove(deal: Deal, state: GameState, m: Move): GameState {
  const why = check(deal, state, m);
  if (why) throw new Error(`illegal move: ${why}`);
  const s = clone(state);
  s.moves += 1;

  if (m.type === 'draw') {
    if (s.stock.length) s.waste.push(s.stock.shift()!);
    else {
      s.stock = s.waste;
      s.waste = [];
    }
    return s;
  }

  // take
  let cards: CardId[];
  if (m.from.kind === 'waste') cards = [s.waste.pop()!];
  else {
    const col = s.columns[m.from.col];
    cards = col.faceUp.splice(col.faceUp.length - m.from.depth, m.from.depth);
    if (!col.faceUp.length && col.faceDown.length) col.faceUp.push(col.faceDown.pop()!);
  }

  // put
  if (m.to.kind === 'column') {
    s.columns[m.to.col].faceUp.push(...cards);
  } else {
    const card = cards[0];
    const cat = categoryOf(deal, card);
    if (isCategoryCard(card)) s.slots[m.to.slot] = { categoryId: cat, count: 0 };
    else {
      const slot = s.slots[m.to.slot]!;
      slot.count += 1;
      const size = deal.categories.find((c) => c.id === cat)!.wordIds.length;
      if (slot.count >= size) {
        s.completed.push(cat);
        s.slots[m.to.slot] = null;
      }
    }
  }
  return s;
}

export function legalMoves(deal: Deal, s: GameState): Move[] {
  const out: Move[] = [];
  const sources: Source[] = [{ kind: 'waste' }];
  s.columns.forEach((c, col) => {
    for (let depth = 1; depth <= c.faceUp.length; depth++) sources.push({ kind: 'column', col, depth });
  });
  const targets: Target[] = [
    ...s.slots.map((_, slot) => ({ kind: 'slot' as const, slot })),
    ...s.columns.map((_, col) => ({ kind: 'column' as const, col })),
  ];
  for (const from of sources) for (const to of targets) {
    const m: Move = { type: 'move', from, to };
    if (!check(deal, s, m)) out.push(m);
  }
  if (!check(deal, s, { type: 'draw' })) out.push({ type: 'draw' });
  return out;
}

export const isWon = (deal: Deal, s: GameState) => s.completed.length === deal.categories.length;
