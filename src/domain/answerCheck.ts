import type { Grade, Word } from './types';

export type Verdict = 'correct' | 'typo' | 'wrong' | 'missing_article' | 'wrong_article' | 'other_word';

const ARTICLES = ['der', 'die', 'das'];
const TYPO_MIN_LEN = 5;

export function normalize(s: string): string {
  return s
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[.!?]+$/, '')
    .trim();
}

export function expectedAnswer(w: Word): string {
  return w.pos === 'noun' && w.article ? `${w.article} ${w.de}` : w.de;
}

/** Optimal string alignment distance (Levenshtein + adjacent transposition). */
function distance(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length];
}

/** 'exact' | 'typo' | 'no' for the lexical part (without article). */
function match(input: string, target: string): 'exact' | 'typo' | 'no' {
  if (input === target) return 'exact';
  return target.length >= TYPO_MIN_LEN && distance(input, target) === 1 ? 'typo' : 'no';
}

const meanings = (w: Word) => w.en.split(';').map((m) => m.trim().toLowerCase()).filter(Boolean);

const SUGGESTED: Record<Verdict, Grade | null> = {
  correct: 3, typo: 2, wrong: 1, missing_article: 1, wrong_article: 1, other_word: null,
};

export function checkAnswer(w: Word, input: string, all: Word[]): { verdict: Verdict; suggested: Grade | null; expected: string } {
  const expected = expectedAnswer(w);
  const result = (verdict: Verdict) => ({ verdict, suggested: SUGGESTED[verdict], expected });
  const n = normalize(input);

  if ([expected, ...(w.accept ?? [])].some((e) => normalize(e) === n)) return result('correct');

  const mine = new Set(meanings(w));
  const other = all.find(
    (o) => o.id !== w.id && normalize(expectedAnswer(o)) === n && meanings(o).some((m) => mine.has(m)),
  );
  if (other) return result('other_word');

  const target = normalize(w.de);
  if (w.pos !== 'noun' || !w.article) return result(match(n, target) === 'typo' ? 'typo' : 'wrong');

  const [first, ...rest] = n.split(' ');
  if (!ARTICLES.includes(first)) return result(match(n, target) === 'no' ? 'wrong' : 'missing_article');
  const m = match(rest.join(' '), target);
  if (m === 'no') return result('wrong');
  if (first !== w.article) return result('wrong_article');
  return result(m === 'typo' ? 'typo' : 'correct');
}
