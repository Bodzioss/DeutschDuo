import { describe, expect, test } from 'vitest';
import { wordStatus } from '@/domain/status';
import { newCard } from '@/domain/fsrs';
import type { CardRecord } from '@/domain/types';

const now = new Date('2026-11-16T10:00:00Z');
const withStab = (stability: number, reps = 3): CardRecord => {
  const c = newCard('x', 'de_en', now);
  return { ...c, fsrs: { ...c.fsrs, stability, reps } };
};

describe('wordStatus', () => {
  test('no cards → new', () => expect(wordStatus([])).toBe('new'));
  test('unreviewed card → new', () => expect(wordStatus([newCard('x', 'de_en', now)])).toBe('new'));
  test('stability 3 → learning', () => expect(wordStatus([withStab(3)])).toBe('learning'));
  test('stability 7 → known', () => expect(wordStatus([withStab(7)])).toBe('known'));
  test('stability 30 → known', () => expect(wordStatus([withStab(30)])).toBe('known'));
  test('stability 30.1 → mastered', () => expect(wordStatus([withStab(30.1)])).toBe('mastered'));
  test('takes max of two cards', () => expect(wordStatus([withStab(2), withStab(40)])).toBe('mastered'));
});
