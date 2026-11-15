import { describe, expect, test } from 'vitest';
import { validateWords } from '@/data/wordSchema';

const base = {
  id: 'der-tisch', de: 'Tisch', article: 'der', plural: 'Tische', pos: 'noun',
  en: 'table', cefr: 'A1', topic: 'home', example_de: 'Der Tisch ist groß.', example_en: 'The table is big.',
};

describe('validateWords', () => {
  test('valid word passes', () => {
    const r = validateWords([base]);
    expect(r.ok.length).toBe(1);
    expect(r.errors).toEqual([]);
  });
  test('noun without article is an error', () => {
    const r = validateWords([{ ...base, article: undefined }]);
    expect(r.errors).toContain('der-tisch: noun requires article');
  });
  test('duplicate id is an error', () => {
    const r = validateWords([base, base]);
    expect(r.errors).toContain('der-tisch: duplicate id');
  });
  test('id must be kebab-case slug', () => {
    const r = validateWords([{ ...base, id: 'Der Tisch' }]);
    expect(r.errors.some((e) => e.includes('invalid id'))).toBe(true);
  });
  test('noun plural must be string or null (not undefined)', () => {
    const { plural: _p, ...noPlural } = base;
    const r = validateWords([noPlural]);
    expect(r.errors).toContain('der-tisch: noun plural must be string or null');
  });
  test('missing required field is an error', () => {
    const r = validateWords([{ ...base, example_en: '' }]);
    expect(r.errors).toContain('der-tisch: missing example_en');
  });
});
