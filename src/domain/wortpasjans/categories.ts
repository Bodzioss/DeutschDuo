import type { Word } from '../types';
import type { CategoryFamily, LevelDef } from './levels';

export interface Category {
  id: string;
  family: CategoryFamily;
  /** German label shown on the category card */
  label: string;
  /** Polish hint */
  hint: string;
  test(w: Word): boolean;
}

const TOPICS: Record<string, [string, string]> = {
  basics: ['Grundwortschatz', 'podstawy'],
  'verbs-core': ['Verben', 'czasowniki'],
  'people-family': ['Familie und Leute', 'rodzina i ludzie'],
  'function-words': ['Kleine Wörter', 'słowa funkcyjne'],
  'numbers-time': ['Zahlen und Zeit', 'liczby i czas'],
  'food-drink': ['Essen und Trinken', 'jedzenie i picie'],
  'adjectives-core': ['Adjektive', 'przymiotniki'],
  home: ['Wohnen', 'dom'],
  'city-transport': ['Stadt und Verkehr', 'miasto i transport'],
  'shopping-money': ['Einkaufen', 'zakupy'],
  'work-school': ['Arbeit und Schule', 'praca i nauka'],
  'free-time': ['Freizeit', 'czas wolny'],
  'body-health': ['Körper und Gesundheit', 'ciało i zdrowie'],
  'weather-nature': ['Wetter und Natur', 'pogoda i przyroda'],
  clothes: ['Kleidung', 'ubrania'],
  travel: ['Reisen', 'podróże'],
};

const isNoun = (w: Word) => w.pos === 'noun';
const deUmlaut = (s: string) => s.toLowerCase().replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u');
/**
 * What the plural adds to the singular (umlaut changes ignored): Haus→Häuser "er", Frau→Frauen "en", Tisch→Tische "e".
 * null when the plural is not singular + suffix (Väter: umlaut only, Museen/Firmen: ending replaced) or missing.
 */
function pluralSuffix(w: Word): string | null {
  if (!isNoun(w) || !w.plural || w.plural === w.de) return null;
  const s = deUmlaut(w.de);
  const p = deUmlaut(w.plural);
  return p.startsWith(s) && p.length > s.length ? p.slice(s.length) : null;
}
const prepIn = (ids: string[]) => (w: Word) => w.pos === 'prep' && ids.includes(w.de);

export const ALL_CATEGORIES: Category[] = [
  ...Object.entries(TOPICS).map(([topic, [label, hint]]) => ({
    id: `topic-${topic}`,
    family: 'topic' as const,
    label,
    hint,
    test: (w: Word) => w.topic === topic,
  })),
  { id: 'gender-der', family: 'gender', label: 'Artikel: der', hint: 'rodzaj męski', test: (w) => isNoun(w) && w.article === 'der' },
  { id: 'gender-die', family: 'gender', label: 'Artikel: die', hint: 'rodzaj żeński', test: (w) => isNoun(w) && w.article === 'die' && w.plural !== w.de },
  { id: 'gender-das', family: 'gender', label: 'Artikel: das', hint: 'rodzaj nijaki', test: (w) => isNoun(w) && w.article === 'das' },
  { id: 'plural-n', family: 'plural', label: 'Plural auf -(e)n', hint: 'l.mn. na -(e)n', test: (w) => ['n', 'en'].includes(pluralSuffix(w) ?? '') },
  { id: 'plural-e', family: 'plural', label: 'Plural auf -e', hint: 'l.mn. na -e', test: (w) => pluralSuffix(w) === 'e' },
  { id: 'plural-er', family: 'plural', label: 'Plural auf -er', hint: 'l.mn. na -er', test: (w) => pluralSuffix(w) === 'er' },
  { id: 'plural-s', family: 'plural', label: 'Plural auf -s', hint: 'l.mn. na -s', test: (w) => pluralSuffix(w) === 's' },
  { id: 'verbs-trennbar', family: 'verbs', label: 'Trennbare Verben', hint: 'czasowniki rozdzielne', test: (w) => w.pos === 'verb' && /trennbar/i.test(w.note ?? '') },
  { id: 'prep-dativ', family: 'preps', label: 'Präpositionen + Dativ', hint: 'przyimki z celownikiem', test: prepIn(['aus', 'bei', 'mit', 'nach', 'seit', 'von', 'zu']) },
  { id: 'prep-akk', family: 'preps', label: 'Präpositionen + Akkusativ', hint: 'przyimki z biernikiem', test: prepIn(['durch', 'für', 'gegen', 'ohne', 'um']) },
  { id: 'prep-wechsel', family: 'preps', label: 'Wechselpräpositionen', hint: 'przyimki z Dat. lub Akk.', test: prepIn(['in', 'an', 'auf', 'vor', 'hinter', 'neben', 'unter', 'über', 'zwischen']) },
];

/** Categories available on a level that have at least `n` words in the vocabulary. */
export function categoriesForLevel(level: LevelDef, words: Word[]): Category[] {
  return ALL_CATEGORIES.filter((c) => level.families.includes(c.family) && words.filter(c.test).length >= level.n);
}
