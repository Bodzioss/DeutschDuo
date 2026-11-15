import { describe, expect, test } from 'vitest';
import { localDay, startOfNextLocalDay } from '@/domain/day';

// TZ = Europe/Warsaw (vitest.config.ts); November = UTC+1
describe('localDay', () => {
  test('02:59 counts as previous day', () => {
    expect(localDay(new Date(2026, 10, 16, 2, 59))).toBe('2026-11-15');
  });
  test('03:00 counts as same day', () => {
    expect(localDay(new Date(2026, 10, 16, 3, 0))).toBe('2026-11-16');
  });
  test('DST change day (2026-03-29) keeps date', () => {
    expect(localDay(new Date(2026, 2, 29, 12, 0))).toBe('2026-03-29');
    expect(localDay(new Date(2026, 2, 29, 3, 30))).toBe('2026-03-29');
    expect(localDay(new Date(2026, 2, 29, 1, 30))).toBe('2026-03-28');
  });
});

describe('startOfNextLocalDay', () => {
  test('23:00 → next day 03:00', () => {
    expect(startOfNextLocalDay(new Date(2026, 10, 16, 23, 0))).toEqual(new Date(2026, 10, 17, 3, 0));
  });
  test('01:00 → same calendar day 03:00', () => {
    expect(startOfNextLocalDay(new Date(2026, 10, 17, 1, 0))).toEqual(new Date(2026, 10, 17, 3, 0));
  });
  test('exactly 03:00 → next day 03:00', () => {
    expect(startOfNextLocalDay(new Date(2026, 10, 17, 3, 0))).toEqual(new Date(2026, 10, 18, 3, 0));
  });
});
