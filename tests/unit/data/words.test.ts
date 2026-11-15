import { expect, test } from 'vitest';
import { getWord, getWords } from '@/data/words';
import { validateWords } from '@/data/wordSchema';

test('all bundled words validate', () => {
  expect(validateWords(getWords()).errors).toEqual([]);
});

test('getWord returns der Tisch', () => {
  expect(getWord('der-tisch')?.article).toBe('der');
});

test('interleave takes words round-robin across topics, keeping order inside each topic', async () => {
  const { interleave } = await import('@/data/words');
  expect(interleave([['a1', 'a2', 'a3'], ['b1'], ['c1', 'c2']])).toEqual(['a1', 'b1', 'c1', 'a2', 'c2', 'a3']);
});
