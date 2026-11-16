export type Article = 'der' | 'die' | 'das';
export type Pos = 'noun' | 'verb' | 'adj' | 'adv' | 'prep' | 'pron' | 'conj' | 'num' | 'phrase' | 'other';
export type Direction = 'de_en' | 'en_de';
/** 1 Again, 2 Hard, 3 Good, 4 Easy — same numbering as ts-fsrs Rating. */
export type Grade = 1 | 2 | 3 | 4;

export interface Word {
  id: string;
  de: string;
  article?: Article;
  plural?: string | null;
  pos: Pos;
  en: string;
  pl?: string;
  cefr: 'A1';
  topic: string;
  example_de: string;
  example_en: string;
  false_friend?: string;
  note?: string;
  emoji?: string;
  en_prompt?: string;
  accept?: string[];
}

/** FSRS card state, dates as ISO strings. */
export interface FsrsState {
  due: string;
  stability: number;
  difficulty: number;
  scheduled_days: number;
  reps: number;
  lapses: number;
  state: 0 | 1 | 2 | 3;
  last_review?: string;
  learning_steps: number;
}

export interface CardRecord {
  id: string;
  wordId: string;
  direction: Direction;
  fsrs: FsrsState;
  updatedAt: string;
  dirty: 0 | 1;
}

export interface ReviewRecord {
  id: string;
  cardId: string;
  rating: Grade;
  durationMs: number;
  reviewedAt: string;
  localDay: string;
  wasNew: boolean;
  closesQueue: boolean;
  /** FSRS interval after this review (used by stats). */
  scheduledDays: number;
  /** Daily goal (minutes) in effect when this review was made; a day is judged by its own goal, not today's. */
  goalMin?: number;
  answer?: string;
  synced: 0 | 1;
}

/** One finished (won, lost or abandoned) Wortpasjans board. */
export interface GameRecord {
  id: string;
  level: string;
  seed: number;
  won: boolean;
  stars: number;
  moves: number;
  par: number;
  peeks: number;
  peekedWordIds: string[];
  durationMs: number;
  playedAt: string;
  localDay: string;
  /** Set when this game was the pair's duel of that learning day (YYYY-MM-DD). */
  duelDay?: string;
  synced: 0 | 1;
}

export interface Profile {
  id: string;
  displayName: string;
  dailyGoalMin: number;
  newPerDay: number;
  showPl: boolean;
}

export const cardId = (wordId: string, d: Direction) => `${wordId}:${d}`;
