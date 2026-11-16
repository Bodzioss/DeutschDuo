import { beforeEach, describe, expect, test, vi } from 'vitest';
import { backend } from '@/data/backend';
import { openProfileDb } from '@/data/db';
import { checkOvertake, reportDuel } from '@/data/notify';
import { recordGame } from '@/data/games';
import { useProfileStore } from '@/stores/profileStore';
import type { Profile, ReviewRecord } from '@/domain/types';

const TODAY = '2026-11-18';
const rev = (minutes: number): ReviewRecord => ({
  id: Math.random().toString(), cardId: 'a:de_en', rating: 3, durationMs: minutes * 60_000, reviewedAt: `${TODAY}T12:00:00.000Z`, localDay: TODAY,
  wasNew: false, closesQueue: false, scheduledDays: 1, goalMin: 15, synced: 1,
});
const prof = (id: string): Profile => ({ id, displayName: id, dailyGoalMin: 15, newPerDay: 10, showPl: false });

let n = 0;
let me: string;
let pa: string;
beforeEach(() => {
  n++;
  me = `me-${n}`;
  pa = `pa-${n}`;
  useProfileStore.setState({ profiles: [prof(me), prof(pa)] });
  vi.restoreAllMocks();
});

describe('checkOvertake', () => {
  test('records on the first run, notifies once when I take the lead, then stays quiet', async () => {
    const spy = vi.spyOn(backend, 'notifyPartner');
    await openProfileDb(pa).reviews.add(rev(10));
    await checkOvertake(me, [pa], TODAY);
    expect(spy).not.toHaveBeenCalled();
    await openProfileDb(me).reviews.add(rev(20));
    await checkOvertake(me, [pa], TODAY);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith({ kind: 'overtake', from: me, to: pa });
    await checkOvertake(me, [pa], TODAY);
    expect(spy).toHaveBeenCalledTimes(1);
  });
  test('swallows backend errors', async () => {
    vi.spyOn(backend, 'notifyPartner').mockRejectedValue(new Error('x'));
    await expect(checkOvertake(me, [pa], TODAY)).resolves.toBeUndefined();
  });
});

describe('reportDuel', () => {
  const play = (id: string) => recordGame(openProfileDb(id), { level: 'berlin-1', seed: 1, won: true, stars: 3, moves: 20, par: 18, peeks: 0, peekedWordIds: [], durationMs: 1000, now: new Date(2026, 10, 18, 12), duelDay: TODAY });
  test('duelBothPlayed reflects the partner having played', async () => {
    const spy = vi.spyOn(backend, 'notifyPartner');
    await reportDuel(me, pa, TODAY);
    expect(spy).toHaveBeenLastCalledWith({ kind: 'duel', from: me, to: pa, duelBothPlayed: false });
    await play(pa);
    await reportDuel(me, pa, TODAY);
    expect(spy).toHaveBeenLastCalledWith({ kind: 'duel', from: me, to: pa, duelBothPlayed: true });
  });
});
