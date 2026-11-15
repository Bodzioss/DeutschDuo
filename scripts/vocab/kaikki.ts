// Parsing of Wiktextract (kaikki.org) JSONL entries for German, and comparison with our vocabulary.
import type { Article, Word } from '../../src/domain/types';

export interface KaikkiEntry {
  word: string;
  pos: string;
  genders: Article[];
  plurals: string[];
  noPlural: boolean;
  pluralOnly: boolean;
}

const G: Record<string, Article> = { m: 'der', f: 'die', n: 'das', p: 'die' };
const TAG_G: Record<string, Article> = { masculine: 'der', feminine: 'die', neuter: 'das' };
const ARTICLE_PREFIX = /^(der|die|das|den|dem|des)\s+/i;
const CASES = ['genitive', 'dative', 'accusative'];

type Raw = {
  word?: string;
  pos?: string;
  tags?: string[];
  head_templates?: { name?: string; args?: Record<string, string>; expansion?: string }[];
  forms?: { form?: string; tags?: string[] }[];
  senses?: { tags?: string[] }[];
};

export function parseKaikkiLine(line: string): KaikkiEntry | null {
  let raw: Raw;
  try {
    raw = JSON.parse(line);
  } catch {
    return null;
  }
  if (!raw.word || !raw.pos) return null;

  const genders = new Set<Article>();
  const tags = new Set([...(raw.tags ?? []), ...(raw.senses ?? []).flatMap((s) => s.tags ?? [])]);
  for (const t of raw.head_templates ?? []) {
    if (!t.name?.startsWith('de-noun')) continue;
    for (const [k, v] of Object.entries(t.args ?? {})) {
      if (/^(\d+|g\d*)$/.test(k)) {
        // e.g. "m,(e)s", "p", "m[Germany]:n[Austria, Switzerland],s,s"
        const spec = v.replace(/\[[^\]]*\]/g, '').split(',')[0];
        for (const code of spec.split(':').map((c) => c.trim())) if (/^[mfnp]$/.test(code)) genders.add(G[code]);
      }
    }
    const m = t.expansion?.match(/^\S+\s+((?:[mfnp](?:\s+or\s+|\s*,\s*)?)+)/);
    if (m) for (const c of m[1].split(/\s+or\s+|,/)) if (G[c.trim()]) genders.add(G[c.trim()]);
    if (/\bno plural\b/.test(t.expansion ?? '')) tags.add('no-plural');
  }
  if (raw.pos === 'noun' && genders.size === 0) for (const t of tags) if (TAG_G[t]) genders.add(TAG_G[t]);

  const plurals = new Set<string>();
  let noPlural = tags.has('no-plural');
  for (const f of raw.forms ?? []) {
    const ft = f.tags ?? [];
    if (ft.includes('no-plural') || f.form === 'no-plural') noPlural = true;
    if (!f.form || !ft.includes('plural') || ft.includes('diminutive')) continue;
    if (CASES.some((c) => ft.includes(c)) && !ft.includes('nominative')) continue;
    plurals.add(f.form.replace(ARTICLE_PREFIX, ''));
  }
  const pluralOnly = tags.has('plural-only') || genders.has('die') && [...(raw.head_templates ?? [])].some((t) => /\bpl\b|plural only/.test(t.expansion ?? ''));

  return { word: raw.word, pos: raw.pos, genders: [...genders], plurals: [...plurals], noPlural: noPlural && plurals.size === 0, pluralOnly };
}

/** 'note' = worth a human look but often fine (e.g. uncountable noun where the dictionary lists a rare plural). */
export type CompareStatus = 'ok' | 'mismatch' | 'note' | 'missing' | 'skipped';

export function compareWord(w: Word, entries: KaikkiEntry[]): { status: CompareStatus; details?: string } {
  if (w.pos === 'phrase' || w.de.includes(' ')) return { status: 'skipped' };
  if (w.pos !== 'noun') {
    return entries.some((e) => e.word === w.de) ? { status: 'ok' } : { status: 'missing' };
  }
  const nouns = entries.filter((e) => e.word === w.de && e.pos === 'noun');
  if (nouns.length === 0) {
    // countries etc. are proper names in Wiktionary: existence is enough
    return entries.some((e) => e.word === w.de && e.pos === 'name') ? { status: 'ok' } : { status: 'missing' };
  }

  const genders = new Set(nouns.flatMap((e) => e.genders));
  const plurals = new Set(nouns.flatMap((e) => e.plurals));
  const problems: string[] = [];

  // a noun taught in its plural form ("die Möbel") uses the plural article, whatever the singular gender is
  const taughtInPlural = w.article === 'die' && w.plural === w.de && plurals.has(w.de);
  if (genders.size && w.article && !taughtInPlural && !genders.has(w.article)) problems.push(`rodzaj: mamy "${w.article}", słownik: ${[...genders].join('/')}`);

  const notes: string[] = [];
  if (w.plural === null) {
    if (plurals.size > 0) notes.push(`l.mn.: mamy brak, słownik: ${[...plurals].join(' / ')}`);
  } else if (w.plural !== undefined) {
    const pluralOnly = nouns.some((e) => e.pluralOnly) && w.plural === w.de;
    if (!pluralOnly && !plurals.has(w.plural)) {
      problems.push(`l.mn.: mamy "${w.plural}", słownik: ${plurals.size ? [...plurals].join(' / ') : 'brak l.mn.'}`);
    }
  }
  if (problems.length) return { status: 'mismatch', details: [...problems, ...notes].join('; ') };
  return notes.length ? { status: 'note', details: notes.join('; ') } : { status: 'ok' };
}
