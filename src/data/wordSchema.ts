import type { Word } from '@/domain/types';

const POS = ['noun', 'verb', 'adj', 'adv', 'prep', 'pron', 'conj', 'num', 'phrase', 'other'];
const ARTICLES = ['der', 'die', 'das'];
const REQUIRED = ['de', 'en', 'topic', 'example_de', 'example_en'] as const;
const ID_RE = /^[a-z0-9äöüß-]+$/;

/** Structural validation of vocabulary entries. Returns valid words and human-readable errors. */
export function validateWords(words: unknown[]): { ok: Word[]; errors: string[] } {
  const ok: Word[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();

  for (const raw of words) {
    const w = raw as Record<string, unknown>;
    const id = typeof w.id === 'string' ? w.id : '<no id>';
    const errs: string[] = [];

    if (!ID_RE.test(id)) errs.push(`${id}: invalid id`);
    if (seen.has(id)) errs.push(`${id}: duplicate id`);
    seen.add(id);
    for (const f of REQUIRED) {
      if (typeof w[f] !== 'string' || (w[f] as string).trim() === '') errs.push(`${id}: missing ${f}`);
    }
    if (!POS.includes(w.pos as string)) errs.push(`${id}: invalid pos`);
    if (w.cefr !== 'A1') errs.push(`${id}: invalid cefr`);
    if (w.article !== undefined && !ARTICLES.includes(w.article as string)) errs.push(`${id}: invalid article`);
    if (w.pos === 'noun') {
      if (w.article === undefined) errs.push(`${id}: noun requires article`);
      if (!(typeof w.plural === 'string' || w.plural === null)) errs.push(`${id}: noun plural must be string or null`);
    }
    if (w.accept !== undefined && !(Array.isArray(w.accept) && w.accept.every((a) => typeof a === 'string'))) {
      errs.push(`${id}: accept must be string[]`);
    }

    if (errs.length) errors.push(...errs);
    else ok.push(w as unknown as Word);
  }
  return { ok, errors };
}
