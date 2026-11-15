/** The learning day ends at 03:00 device-local time. */
export const DAY_START_HOUR = 3;

const pad = (n: number) => String(n).padStart(2, '0');

/** Local learning day `YYYY-MM-DD` (times before 03:00 belong to the previous day). Uses wall-clock time, so DST is safe. */
export function localDay(at: Date): string {
  const d = new Date(at.getFullYear(), at.getMonth(), at.getDate() - (at.getHours() < DAY_START_HOUR ? 1 : 0));
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** The next 03:00 local time strictly after `at`. */
export function startOfNextLocalDay(at: Date): Date {
  const sameDay = new Date(at.getFullYear(), at.getMonth(), at.getDate(), DAY_START_HOUR);
  return at < sameDay ? sameDay : new Date(at.getFullYear(), at.getMonth(), at.getDate() + 1, DAY_START_HOUR);
}

/** `YYYY-MM-DD` + n days (calendar arithmetic, timezone independent). */
export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}
