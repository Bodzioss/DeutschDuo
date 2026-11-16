export type CategoryFamily = 'topic' | 'gender' | 'plural' | 'verbs' | 'preps';

export interface LevelDef {
  id: string;
  city: string;
  /** 1-based board number within the city */
  index: number;
  /** number of categories on the board */
  k: number;
  /** words per category */
  n: number;
  /** category slots */
  slots: number;
  families: CategoryFamily[];
}

const CITIES: { id: string; city: string; k: number; n: number; slots: number; families: CategoryFamily[] }[] = [
  { id: 'berlin', city: 'Berlin', k: 3, n: 3, slots: 3, families: ['topic'] },
  { id: 'hamburg', city: 'Hamburg', k: 4, n: 3, slots: 3, families: ['topic', 'gender'] },
  { id: 'munchen', city: 'München', k: 4, n: 4, slots: 3, families: ['topic', 'gender', 'plural'] },
  { id: 'wien', city: 'Wien', k: 5, n: 4, slots: 4, families: ['topic', 'gender', 'plural', 'verbs', 'preps'] },
  { id: 'zurich', city: 'Zürich', k: 5, n: 5, slots: 4, families: ['topic', 'gender', 'plural', 'verbs', 'preps'] },
];

export const BOARDS_PER_CITY = 5;

export const LEVELS: LevelDef[] = CITIES.flatMap((c) =>
  Array.from({ length: BOARDS_PER_CITY }, (_, i) => ({
    id: `${c.id}-${i + 1}`,
    city: c.city,
    index: i + 1,
    k: c.k,
    n: c.n,
    slots: c.slots,
    families: c.families,
  })),
);

export const levelById = (id: string): LevelDef | undefined => LEVELS.find((l) => l.id === id);

export function nextLevel(id: string): LevelDef | undefined {
  const i = LEVELS.findIndex((l) => l.id === id);
  return i >= 0 ? LEVELS[i + 1] : undefined;
}
