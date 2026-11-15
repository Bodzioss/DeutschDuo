// @vitest-environment node
import { describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { compareWord, parseKaikkiLine, type KaikkiEntry } from '../../../scripts/vocab/kaikki';
import type { Word } from '@/domain/types';

const lines = readFileSync('tests/fixtures/kaikki-sample.jsonl', 'utf8').trim().split('\n');
const entries = lines.map(parseKaikkiLine).filter((e): e is KaikkiEntry => e !== null);
const find = (w: string, pos = 'noun') => entries.filter((e) => e.word === w && e.pos === pos);
const noun = (de: string, article: Word['article'], plural: string | null): Word => ({
  id: `${article}-${de.toLowerCase()}`, de, article, plural, pos: 'noun', en: 'x', cefr: 'A1', topic: 't', example_de: 'x', example_en: 'x',
});

describe('parseKaikkiLine', () => {
  test('Tisch → der, [Tische]', () => expect(find('Tisch')[0]).toMatchObject({ genders: ['der'], plurals: ['Tische'] }));
  test('Straße → die, [Straßen]', () => expect(find('Straße')[0]).toMatchObject({ genders: ['die'], plurals: ['Straßen'] }));
  test('Haus → das, [Häuser] (diminutive ignored)', () => expect(find('Haus')[0]).toMatchObject({ genders: ['das'], plurals: ['Häuser'] }));
  test('verb line → pos verb, no gender', () => expect(find('gehen', 'verb')[0]).toMatchObject({ pos: 'verb', genders: [] }));
  test('no-plural noun → plurals [] and noPlural', () => expect(find('Milch')[0]).toMatchObject({ plurals: [], noPlural: true }));
  test('two genders', () => expect(find('Joghurt')[0].genders.sort()).toEqual(['das', 'der']));
  test('garbage line → null', () => expect(parseKaikkiLine('{oops')).toBeNull());
});

describe('compareWord', () => {
  test('correct noun → ok', () => expect(compareWord(noun('Tisch', 'der', 'Tische'), find('Tisch')).status).toBe('ok'));
  test('wrong article → mismatch', () => {
    const r = compareWord(noun('Tisch', 'die', 'Tische'), find('Tisch'));
    expect(r.status).toBe('mismatch');
    expect(r.details).toContain('der');
  });
  test('wrong plural → mismatch', () => expect(compareWord(noun('Tisch', 'der', 'Tischen'), find('Tisch')).status).toBe('mismatch'));
  test('plural null when dictionary has none → ok', () => expect(compareWord(noun('Milch', 'die', null), find('Milch')).status).toBe('ok'));
  test('plural null but dictionary has one → note for human review', () => expect(compareWord(noun('Tisch', 'der', null), find('Tisch')).status).toBe('note'));
  test('either gender accepted when dictionary lists two', () => expect(compareWord(noun('Joghurt', 'das', 'Joghurts'), find('Joghurt')).status).toBe('ok'));
  test('unknown word → missing', () => expect(compareWord(noun('Quatschwort', 'der', null), []).status).toBe('missing'));
  test('verb present in dictionary → ok', () => {
    const w: Word = { id: 'gehen', de: 'gehen', pos: 'verb', en: 'to go', cefr: 'A1', topic: 't', example_de: 'x', example_en: 'x' };
    expect(compareWord(w, find('gehen', 'verb')).status).toBe('ok');
  });
});

describe('ambiguousMeanings', () => {
  test('flags shared English meanings when a word lacks en_prompt', async () => {
    const { ambiguousMeanings } = await import('../../../scripts/vocab/validate');
    const w = (id: string, en: string, en_prompt?: string): Word => ({ id, de: id, pos: 'adj', en, en_prompt, cefr: 'A1', topic: 't', example_de: 'x', example_en: 'x' });
    expect(ambiguousMeanings([w('schön', 'nice; beautiful'), w('nett', 'nice; kind')])).toHaveLength(1);
    expect(ambiguousMeanings([w('schön', 'nice; beautiful', 'beautiful'), w('nett', 'nice; kind', 'nice (person)')])).toHaveLength(0);
    expect(ambiguousMeanings([w('a', 'table'), w('b', 'chair')])).toHaveLength(0);
  });
});

describe('real kaikki entries (excerpt, CC BY-SA Wiktionary)', () => {
  const real = readFileSync('tests/fixtures/kaikki-real.jsonl', 'utf8').trim().split('\n').map(parseKaikkiLine).filter((e): e is KaikkiEntry => !!e);
  const get = (w: string) => real.filter((e) => e.word === w);
  test('regional gender spec m[Germany]:n[Austria…] → der and das (and rare f)', () => {
    expect(new Set(get('Joghurt').flatMap((e) => e.genders))).toEqual(new Set(['der', 'das', 'die']));
  });
  test('plural-only Eltern → die, plural Eltern', () => {
    expect(get('Eltern')[0]).toMatchObject({ genders: ['die'], pluralOnly: true });
    expect(compareWord(noun('Eltern', 'die', 'Eltern'), get('Eltern')).status).toBe('ok');
  });
  test('uncountable with only a technical plural (Milch → Milchen) is a note, not a mismatch', () => {
    const r = compareWord(noun('Milch', 'die', null), get('Milch'));
    expect(r.status).toBe('note');
    expect(r.details).toContain('Milchen');
  });
});

describe('compareWord special cases', () => {
  const entry = (p: Partial<KaikkiEntry> & { word: string }): KaikkiEntry => ({ pos: 'noun', genders: [], plurals: [], noPlural: false, pluralOnly: false, ...p });
  test('noun taught in the plural with "die" (die Möbel) is ok when the dictionary plural matches', () => {
    expect(compareWord(noun('Möbel', 'die', 'Möbel'), [entry({ word: 'Möbel', genders: ['das'], plurals: ['Möbel'] })]).status).toBe('ok');
  });
  test('country stored as proper name in the dictionary → ok', () => {
    expect(compareWord(noun('Deutschland', 'das', null), [entry({ word: 'Deutschland', pos: 'name' })]).status).toBe('ok');
  });
});
