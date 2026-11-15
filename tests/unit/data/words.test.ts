import { expect, test } from 'vitest';
import { getWord, getWords } from '@/data/words';
import { validateWords } from '@/data/wordSchema';

test('all bundled words validate', () => {
  expect(validateWords(getWords()).errors).toEqual([]);
});

test('getWord returns der Tisch', () => {
  expect(getWord('der-tisch')?.article).toBe('der');
});
