import { rateCard } from './fsrs';
import type { CardRecord, Grade } from './types';

const GRADES: Grade[] = [1, 2, 3, 4];

/** Milliseconds until the next review for each possible grade (what the rating buttons will schedule). */
export function intervalsFor(card: CardRecord, now: Date): Record<Grade, number> {
  const out = {} as Record<Grade, number>;
  for (const g of GRADES) out[g] = new Date(rateCard(card, g, now).fsrs.due).getTime() - now.getTime();
  return out;
}

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const oneDecimal = (n: number) => (Math.round(n * 10) / 10).toString().replace('.', ',');

/** Short Polish label: "<1 min", "10 min", "2 godz.", "1 dzień", "3 dni", "1,5 mies.", "1,1 roku". */
export function formatInterval(ms: number): string {
  if (ms < MIN) return '<1 min';
  if (ms < HOUR) return `${Math.round(ms / MIN)} min`;
  if (ms < DAY) return `${Math.round(ms / HOUR)} godz.`;
  const days = Math.round(ms / DAY);
  if (days < 30) return days === 1 ? '1 dzień' : `${days} dni`;
  if (days < 365) return `${oneDecimal(days / 30)} mies.`;
  const years = Math.round((days / 365) * 10) / 10;
  if (Number.isInteger(years)) return years === 1 ? '1 rok' : years < 5 ? `${years} lata` : `${years} lat`;
  return `${oneDecimal(years)} roku`;
}
