import type { Word } from '@/domain/types';

/** Topic files in display order. New words are introduced round-robin across these (see interleave). */
export const TOPIC_ORDER: string[] = [
  'basics',
  'verbs-core',
  'people-family',
  'function-words',
  'numbers-time',
  'food-drink',
  'adjectives-core',
  'home',
  'city-transport',
  'shopping-money',
  'work-school',
  'free-time',
  'body-health',
  'weather-nature',
  'clothes',
  'travel',
];

export const TOPIC_LABELS: Record<string, string> = {
  basics: 'Podstawy',
  'verbs-core': 'Czasowniki',
  'people-family': 'Ludzie i rodzina',
  'function-words': 'Słowa funkcyjne',
  'numbers-time': 'Liczby i czas',
  'food-drink': 'Jedzenie i picie',
  'adjectives-core': 'Przymiotniki',
  home: 'Dom',
  'city-transport': 'Miasto i transport',
  'shopping-money': 'Zakupy i pieniądze',
  'work-school': 'Praca i nauka',
  'free-time': 'Czas wolny',
  'body-health': 'Ciało i zdrowie',
  'weather-nature': 'Pogoda i przyroda',
  clothes: 'Ubrania',
  travel: 'Podróże',
};

/** Round-robin merge: first item of each list, then the second of each, … (order inside each list is kept). */
export function interleave<T>(lists: T[][]): T[] {
  const out: T[] = [];
  const max = Math.max(0, ...lists.map((l) => l.length));
  for (let i = 0; i < max; i++) for (const l of lists) if (i < l.length) out.push(l[i]);
  return out;
}

const modules = import.meta.glob<{ default: Word[] }>('/data/vocab/a1/*.json', { eager: true });

const topicOf = (path: string) => path.split('/').pop()!.replace(/\.json$/, '');
const rank = (t: string) => (TOPIC_ORDER.indexOf(t) === -1 ? 999 : TOPIC_ORDER.indexOf(t));

const lists: Word[][] = Object.entries(modules)
  .sort(([a], [b]) => rank(topicOf(a)) - rank(topicOf(b)) || a.localeCompare(b))
  .map(([, m]) => m.default);

/** All words in introduction order (frequency order inside a topic, topics interleaved). */
const ordered: Word[] = interleave(lists);
const byId = new Map(ordered.map((w) => [w.id, w]));

export const getWords = (): Word[] => ordered;
export const getWord = (id: string): Word | undefined => byId.get(id);
