// Pure decision logic for Web Push reminders. No imports from src/, no Deno or browser globals.

export type Kind = 'goal' | 'streak' | 'duel' | 'overtake';
export interface Prefs { goal: boolean; goalHour: number; streak: boolean; partner: boolean }
export interface DayStat { minutes: number; goalMin: number; queueClosed: boolean }
export interface Push { kind: Kind; title: string; body: string; url: '/' | '/para' }

const DAY_START_SHIFT_MIN = 3 * 60;
const CAP = 3;
const GOAL_END = 23 * 60;
const STREAK_START = 21 * 60 + 30;
const STREAK_END = 23 * 60 + 30;
const PARTNER_START = 8 * 60;
const PARTNER_END = 22 * 60;

const pad = (n: number) => String(n).padStart(2, '0');

export function localClock(now: Date, tz: string): { day: string; minutesOfDay: number } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(now);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const minutesOfDay = (get('hour') % 24) * 60 + get('minute');
  // Calendar date of (local wall-clock − 3 h), computed on a UTC-labelled timeline.
  const shifted = new Date(Date.UTC(get('year'), get('month') - 1, get('day'), 0, minutesOfDay - DAY_START_SHIFT_MIN));
  const day = `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`;
  return { day, minutesOfDay };
}

export function prevDay(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d - 1));
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

const goalMet = (d?: DayStat) => !!d && (d.minutes >= d.goalMin || d.queueClosed);
const remaining = (d: DayStat) => Math.max(1, Math.ceil(d.goalMin - d.minutes));

export function decideScheduled(i: {
  now: Date;
  tz: string;
  prefs: Prefs;
  today?: DayStat;
  yesterday?: DayStat;
  sentToday: Kind[];
}): Push[] {
  const { minutesOfDay: m } = localClock(i.now, i.tz);
  const { prefs, today, sentToday } = i;
  if (!today || goalMet(today)) return [];

  if (
    prefs.streak &&
    !sentToday.includes('streak') &&
    m >= STREAK_START &&
    m < STREAK_END &&
    goalMet(i.yesterday)
  ) {
    return [
      {
        kind: 'streak',
        title: '🔥 Nie przerywaj serii!',
        body: `Do celu brakuje ${remaining(today)} min. Zdążysz przed końcem dnia.`,
        url: '/',
      },
    ];
  }

  if (
    prefs.goal &&
    !sentToday.includes('goal') &&
    sentToday.length < CAP &&
    m >= prefs.goalHour * 60 &&
    m < GOAL_END
  ) {
    return [
      {
        kind: 'goal',
        title: '⏰ Cel na dziś',
        body: `Zostało ok. ${remaining(today)} min. Kilka fiszek i gotowe.`,
        url: '/',
      },
    ];
  }
  return [];
}

export function decidePartner(
  kind: 'duel' | 'overtake',
  i: { now: Date; tz: string; prefs: Prefs; sentToday: Kind[]; partnerName: string; duelBothPlayed?: boolean },
): Push | null {
  const { minutesOfDay: m } = localClock(i.now, i.tz);
  if (!i.prefs.partner || i.sentToday.includes(kind) || i.sentToday.length >= CAP) return null;
  if (m < PARTNER_START || m >= PARTNER_END) return null;
  if (kind === 'duel') {
    return {
      kind,
      title: `⚔️ ${i.partnerName} zagrał(a) pojedynek dnia`,
      body: i.duelBothPlayed ? 'Wynik pojedynku czeka.' : 'Twoja kolej!',
      url: '/para',
    };
  }
  return { kind, title: `🏆 ${i.partnerName} wyprzedza Cię w lidze`, body: 'Odbijesz?', url: '/para' };
}
