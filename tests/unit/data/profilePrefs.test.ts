import { describe, expect, test } from 'vitest';
import { DEFAULT_NOTIFY, notifyPrefs, type NotifyPrefs, type Profile } from '@/domain/types';

const base: Profile = { id: 'p', displayName: 'N', dailyGoalMin: 15, newPerDay: 10, showPl: true };

describe('notifyPrefs', () => {
  test('profile without notify gets defaults', () => {
    expect(notifyPrefs(base)).toEqual(DEFAULT_NOTIFY);
    expect(DEFAULT_NOTIFY).toEqual({ goal: true, goalHour: 19, streak: true, partner: true });
  });
  test('partial notify keeps the other defaults', () => {
    expect(notifyPrefs({ ...base, notify: { goal: false } as NotifyPrefs })).toEqual({ ...DEFAULT_NOTIFY, goal: false });
  });
});
