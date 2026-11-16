import { describe, expect, test } from 'vitest';
import { classifyError, hasStoredSession } from '@/data/backend/supabase';

describe('hasStoredSession', () => {
  test('expired access token but refresh token present → signed in (works offline)', () => {
    const raw = JSON.stringify({ access_token: 'x', refresh_token: 'r', expires_at: 1 });
    expect(hasStoredSession(raw)).toBe(true);
  });
  test('nothing stored → signed out', () => expect(hasStoredSession(null)).toBe(false));
  test('garbage → signed out', () => expect(hasStoredSession('{oops')).toBe(false));
  test('no refresh token → signed out', () => expect(hasStoredSession(JSON.stringify({ access_token: 'x' }))).toBe(false));
});

describe('classifyError', () => {
  test('invalid credentials → bad_password', () => expect(classifyError({ message: 'Invalid login credentials', status: 400 })).toBe('bad_password'));
  test('network failure → offline', () => expect(classifyError({ message: 'TypeError: Failed to fetch' })).toBe('offline'));
  test('permission denied (42501) → unauthorized', () =>
    expect(classifyError({ code: '42501', message: 'permission denied for table reviews' })).toBe('unauthorized'));
  test('PostgREST JWT errors → unauthorized', () => {
    expect(classifyError({ code: 'PGRST301', message: 'JWT expired' })).toBe('unauthorized');
    expect(classifyError({ code: 'PGRST303', message: 'x' })).toBe('unauthorized');
  });
  test('rate limit is not offline', () => expect(classifyError({ message: 'Request rate limit reached', status: 429 })).toBe('other'));
});

describe('pull cursor', () => {
  test('null cursor starts from scratch', async () => {
    const { parseCursor } = await import('@/data/backend/supabase');
    expect(parseCursor(null)).toEqual({ seq: 0, changedAfter: null });
  });
  test('cursor keeps seq and re-reads rows changed within the safety window before the newest seen change', async () => {
    const { makeCursor, parseCursor, SAFETY_WINDOW_MS } = await import('@/data/backend/supabase');
    const c = makeCursor(42, '2026-11-16T10:00:00.000Z');
    expect(parseCursor(c)).toEqual({
      seq: 42,
      changedAfter: new Date(Date.parse('2026-11-16T10:00:00.000Z') - SAFETY_WINDOW_MS).toISOString(),
    });
    expect(SAFETY_WINDOW_MS).toBeGreaterThanOrEqual(60_000);
  });
  test('legacy numeric cursor still parses', async () => {
    const { parseCursor } = await import('@/data/backend/supabase');
    expect(parseCursor('17')).toEqual({ seq: 17, changedAfter: null });
  });
});

describe('profileUpdateRow', () => {
  const p = { id: 'p1', displayName: 'Nikola', dailyGoalMin: 15, newPerDay: 10, showPl: true };
  test('profile cached before notifications (no notify) does not touch notify_* columns', async () => {
    const { profileUpdateRow } = await import('@/data/backend/supabase');
    const row = profileUpdateRow(p);
    expect(row).toEqual({ display_name: 'Nikola', daily_goal_min: 15, new_per_day: 10, show_pl: true });
    expect(Object.keys(row).some((k) => k.startsWith('notify_'))).toBe(false);
  });
  test('profile with notify writes all notify_* columns', async () => {
    const { profileUpdateRow } = await import('@/data/backend/supabase');
    expect(profileUpdateRow({ ...p, notify: { goal: false, goalHour: 21, streak: true, partner: false } })).toEqual({
      display_name: 'Nikola', daily_goal_min: 15, new_per_day: 10, show_pl: true,
      notify_goal: false, notify_goal_hour: 21, notify_streak: true, notify_partner: false,
    });
  });
});
