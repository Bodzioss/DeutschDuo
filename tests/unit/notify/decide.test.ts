import { describe, it, expect } from 'vitest';
import {
  localClock,
  prevDay,
  decideScheduled,
  decidePartner,
  type Prefs,
  type DayStat,
  type Kind,
} from '../../../supabase/functions/_shared/decide';

const TZ = 'Europe/Warsaw';
const prefs: Prefs = { goal: true, goalHour: 19, streak: true, partner: true };
const unmet: DayStat = { minutes: 7.2, goalMin: 15, queueClosed: false };
const met: DayStat = { minutes: 20, goalMin: 15, queueClosed: false };
// 2026-11-16 in Warsaw is UTC+1
const at = (hh: number, mm: number) => new Date(Date.UTC(2026, 10, 16, hh - 1, mm));

function sched(over: Partial<Parameters<typeof decideScheduled>[0]> & { now: Date }) {
  return decideScheduled({ tz: TZ, prefs, today: unmet, yesterday: met, sentToday: [], ...over });
}

describe('localClock', () => {
  it('returns day and minutes of day', () => {
    expect(localClock(new Date('2026-11-16T18:10:00Z'), TZ)).toEqual({ day: '2026-11-16', minutesOfDay: 1150 });
  });
  it('uses previous learning day before 03:00', () => {
    expect(localClock(new Date('2026-11-17T01:30:00Z'), TZ).day).toBe('2026-11-16');
  });
  it('prevDay', () => {
    expect(prevDay('2026-03-01')).toBe('2026-02-28');
    expect(prevDay('2026-01-01')).toBe('2025-12-31');
  });
});

describe('decideScheduled goal', () => {
  it('fires at 19:10', () => {
    expect(sched({ now: new Date('2026-11-16T18:10:00Z') })).toEqual([
      { kind: 'goal', title: '⏰ Cel na dziś', body: 'Zostało ok. 8 min. Kilka fiszek i gotowe.', url: '/' },
    ]);
  });
  it('not before goalHour, after 23:00, when sent, disabled or queue closed', () => {
    expect(sched({ now: at(18, 50) })).toEqual([]);
    expect(sched({ now: at(23, 5), yesterday: undefined })).toEqual([]);
    expect(sched({ now: at(19, 10), sentToday: ['goal'] })).toEqual([]);
    expect(sched({ now: at(19, 10), prefs: { ...prefs, goal: false } })).toEqual([]);
    expect(sched({ now: at(19, 10), today: { minutes: 2, goalMin: 15, queueClosed: true } })).toEqual([]);
  });
  it('minimum remaining is 1', () => {
    const r = sched({ now: at(19, 10), today: { minutes: 14.99, goalMin: 15, queueClosed: false } });
    expect(r[0].body).toContain('ok. 1 min');
  });
});

describe('decideScheduled streak', () => {
  const t3: DayStat = { minutes: 3, goalMin: 15, queueClosed: false };
  it('fires at 21:40', () => {
    expect(sched({ now: at(21, 40), today: t3 })).toEqual([
      { kind: 'streak', title: '🔥 Nie przerywaj serii!', body: 'Do celu brakuje 12 min. Zdążysz przed końcem dnia.', url: '/' },
    ]);
  });
  it('respects windows and yesterday', () => {
    expect(sched({ now: at(21, 40), today: t3, yesterday: { ...met, minutes: 1 } }).map((p) => p.kind)).toEqual(['goal']);
    expect(sched({ now: at(21, 40), today: t3, yesterday: undefined }).map((p) => p.kind)).toEqual(['goal']);
    expect(sched({ now: at(21, 20), today: t3 }).map((p) => p.kind)).toEqual(['goal']);
    expect(sched({ now: at(23, 40), today: t3 })).toEqual([]);
  });
  it('only streak when goal also due', () => {
    expect(sched({ now: at(21, 40) }).map((p) => p.kind)).toEqual(['streak']);
  });
  it('exempt from cap, goal is not', () => {
    const s: Kind[] = ['goal', 'duel', 'overtake'];
    expect(sched({ now: at(21, 40), sentToday: s }).map((p) => p.kind)).toEqual(['streak']);
    expect(sched({ now: at(21, 10), sentToday: ['duel', 'overtake', 'streak'] })).toEqual([]);
  });
  it('nothing at 02:30', () => {
    expect(sched({ now: new Date('2026-11-17T01:30:00Z') })).toEqual([]);
  });
});

describe('decidePartner', () => {
  const base = { tz: TZ, prefs, sentToday: [] as Kind[], partnerName: 'Nikola' };
  it('duel', () => {
    expect(decidePartner('duel', { ...base, now: at(12, 0) })).toEqual({
      kind: 'duel', title: '⚔️ Nikola zagrał(a) pojedynek dnia', body: 'Twoja kolej!', url: '/para',
    });
    expect(decidePartner('duel', { ...base, now: at(12, 0), duelBothPlayed: true })?.body).toBe('Wynik pojedynku czeka.');
  });
  it('overtake', () => {
    expect(decidePartner('overtake', { ...base, now: at(12, 0) })).toEqual({
      kind: 'overtake', title: '🏆 Nikola wyprzedza Cię w lidze', body: 'Odbijesz?', url: '/para',
    });
  });
  it('null cases', () => {
    expect(decidePartner('duel', { ...base, now: at(7, 30) })).toBeNull();
    expect(decidePartner('duel', { ...base, now: at(22, 10) })).toBeNull();
    expect(decidePartner('duel', { ...base, now: at(12, 0), sentToday: ['duel'] })).toBeNull();
    expect(decidePartner('duel', { ...base, now: at(12, 0), prefs: { ...prefs, partner: false } })).toBeNull();
    expect(decidePartner('duel', { ...base, now: at(12, 0), sentToday: ['goal', 'streak', 'overtake'] })).toBeNull();
  });
});
