# Etap 2 — Wortpasjans Implementation Plan

**Spec:** `docs/superpowers/specs/2026-11-16-etap-2-wortpasjans-design.md`
**Execution:** inline, TDD for `src/domain` and `src/data`; review before deploy.

## Interfaces (src/domain/wortpasjans/)

```ts
// categories.ts
export interface Category { id: string; label: string; hint: string; test(w: Word): boolean }
export function categoriesForLevel(level: LevelDef): Category[]
export const ALL_CATEGORIES: Category[]

// levels.ts
export interface LevelDef { id: string; city: string; index: number; k: number; n: number; slots: number; families: CategoryFamily[] }
export type CategoryFamily = 'topic' | 'gender' | 'plural' | 'verbs' | 'preps'
export const LEVELS: LevelDef[]           // 25 levels: berlin-1 … zurich-5
export function nextLevel(id: string): LevelDef | undefined

// rng.ts
export function mulberry32(seed: number): () => number
export function shuffle<T>(xs: T[], rnd: () => number): T[]

// engine.ts
export type CardId = string               // 'cat:<categoryId>' | 'w:<wordId>'
export interface Deal { seed: number; level: string; categories: { id: string; label: string; hint: string; wordIds: string[] }[]; columns: CardId[][]; stock: CardId[]; slots: number }
export interface GameState { columns: { faceDown: CardId[]; faceUp: CardId[] }[]; stock: CardId[]; waste: CardId[]; slots: ({ categoryId: string; count: number } | null)[]; completed: string[]; moves: number }
export type Source = { kind: 'column'; col: number; depth: number } | { kind: 'waste' }   // depth = how many face-up cards from the top
export type Target = { kind: 'column'; col: number } | { kind: 'slot'; slot: number }
export type Move = { type: 'draw' } | { type: 'move'; from: Source; to: Target }
export function initialState(deal: Deal): GameState
export function categoryOf(deal: Deal, card: CardId): string
export function legalMoves(deal: Deal, s: GameState): Move[]
export function applyMove(deal: Deal, s: GameState, m: Move): GameState   // throws on illegal
export function isWon(deal: Deal, s: GameState): boolean

// solver.ts
export function solve(deal: Deal, budget?: number): { solvable: boolean; par: number; moves: Move[] }

// generator.ts
export interface WordPool { words: Word[]; rank(w: Word): number }      // lower rank = preferred
export function generateDeal(seed: number, level: LevelDef, pool: WordPool): { deal: Deal; par: number; moveLimit: number }

// scoring.ts
export function stars(r: { won: boolean; moves: number; par: number; peeks: number }): 0 | 1 | 2 | 3
export const FREE_PEEKS = 3
```

## Tasks
1. rng + levels + categories (unambiguous matching), tests.
2. engine (all rules) tests first.
3. solver + generator (+ fixed-seed determinism, unambiguity, solvable), tests.
4. scoring + progress derivation (`bestStarsByLevel(games)`, `isUnlocked`), tests.
5. data: Dexie v2 `games`, `recordGame`, `peekWord` (due-now on de_en), personal pool ranking from SRS; tests.
6. sync: `game_sessions` migration 0003 (PGlite test), backend push/pull games, syncProfile extension; tests.
7. UI: Gra tab, map, board (tap-to-move, peek, stock), summary, "Ćwicz teraz" (session from word ids), Heute tile.
8. E2E (solver-replayed win), screenshots 375 light/dark, review, deploy (migration 0003 first).
