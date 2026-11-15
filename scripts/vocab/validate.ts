// Validates data/vocab/a1/*.json against a Wiktextract (kaikki.org) German JSONL dump and writes data/vocab/report.md.
// Usage: npm run vocab:validate -- <path/to/kaikki-german.jsonl> [--structure-only]
import { createReadStream, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { createGunzip } from 'node:zlib';
import { join } from 'node:path';
import type { Word } from '../../src/domain/types';
import { compareWord, parseKaikkiLine, type KaikkiEntry } from './kaikki';
import { validateWords } from '../../src/data/wordSchema';

const DIR = 'data/vocab/a1';
const REPORT = 'data/vocab/report.md';

function loadWords(): Word[] {
  return readdirSync(DIR)
    .filter((f) => f.endsWith('.json'))
    .flatMap((f) => JSON.parse(readFileSync(join(DIR, f), 'utf8')) as Word[]);
}

/** English meanings shared by several words that lack an en_prompt (EN→DE question would be ambiguous). */
export function ambiguousMeanings(words: Word[]): string[] {
  const by = new Map<string, Word[]>();
  for (const w of words) {
    for (const m of w.en.split(';').map((s) => s.trim().toLowerCase()).filter(Boolean)) by.set(m, [...(by.get(m) ?? []), w]);
  }
  return [...by]
    .filter(([, ws]) => ws.length > 1 && ws.filter((w) => !w.en_prompt).length > 0)
    .map(([m, ws]) => `"${m}": ${ws.map((w) => `${w.id}${w.en_prompt ? '' : ' (bez en_prompt)'}`).join(', ')}`);
}

async function main() {
  const [path, flag] = process.argv.slice(2);
  const structureOnly = flag === '--structure-only' || path === '--structure-only';
  const words = loadWords();
  const out: string[] = ['# Raport walidacji słownictwa A1', '', `Słów: ${words.length}. Wygenerowano: ${new Date().toISOString()}`, ''];

  const schema = validateWords(words);
  const ambiguous = ambiguousMeanings(words);

  let mismatch: string[] = [];
  let missing: string[] = [];
  const notes: string[] = [];
  let ok = 0;
  let skipped = 0;

  if (!structureOnly) {
    if (!path) throw new Error('Podaj ścieżkę do pliku JSONL z kaikki.org albo --structure-only');
    const wanted = new Set(words.map((w) => w.de));
    const index = new Map<string, KaikkiEntry[]>();
    const file = createReadStream(path);
    const input = path.endsWith('.gz') ? file.pipe(createGunzip()) : file;
    input.setEncoding('utf8');
    const rl = createInterface({ input, crlfDelay: Infinity });
    for await (const line of rl) {
      // cheap pre-filter: any "word" key in the line is one of ours (nested keys exist, so parse to be sure)
      let hit = false;
      for (const m of line.matchAll(/"word": ?"([^"]+)"/g)) if (wanted.has(m[1])) hit = true;
      if (!hit) continue;
      const e = parseKaikkiLine(line);
      if (e && wanted.has(e.word)) index.set(e.word, [...(index.get(e.word) ?? []), e]);
    }
    for (const w of words) {
      const r = compareWord(w, index.get(w.de) ?? []);
      if (r.status === 'ok') ok++;
      else if (r.status === 'skipped') skipped++;
      else if (r.status === 'mismatch') mismatch.push(`- \`${w.id}\` (${w.article ? w.article + ' ' : ''}${w.de}, l.mn. ${w.plural ?? '—'}): ${r.details}`);
      else if (r.status === 'note') notes.push(`- \`${w.id}\` (${w.article ? w.article + ' ' : ''}${w.de}): ${r.details}`);
      else missing.push(`- \`${w.id}\` (${w.de}, ${w.pos})`);
    }
  }

  const section = (title: string, rows: string[]) => out.push(`## ${title} (${rows.length})`, '', ...(rows.length ? rows : ['_brak_']), '');
  section('Błędy struktury', schema.errors.map((e) => `- ${e}`));
  if (!structureOnly) {
    section('Niezgodne ze słownikiem', mismatch);
    section('Do przejrzenia (zwykle OK: rzeczowniki niepoliczalne)', notes);
    section('Nieznalezione w słowniku', missing);
  }
  section('Powtórzone znaczenia EN bez en_prompt', ambiguous.map((a) => `- ${a}`));
  if (!structureOnly) out.push(`## Zgodne: ${ok}, pominięte (zwroty): ${skipped}`, '');
  out.push('Źródło: Wiktionary przez Wiktextract (kaikki.org), CC BY-SA 4.0.', '');

  writeFileSync(REPORT, out.join('\n'));
  console.log(`report → ${REPORT}: schema ${schema.errors.length}, mismatch ${mismatch.length}, missing ${missing.length}, ambiguous ${ambiguous.length}, ok ${ok}`);
  if (schema.errors.length || mismatch.length) process.exitCode = 1;
}

if (process.argv[1]?.replace(/\\/g, '/').endsWith('scripts/vocab/validate.ts')) {
  main().catch((e) => {
    console.error(e);
    process.exit(2);
  });
}
