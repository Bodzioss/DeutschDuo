import { addDays } from '@/domain/day';

const level = (m: number) => (m <= 0 ? 0 : m <= 5 ? 1 : m <= 15 ? 2 : 3);
const FILL = ['fill-muted/15', 'fill-das/35', 'fill-das/65', 'fill-das'];

/** 16-week activity heatmap: columns = weeks (Mon..Sun rows), last column = this week. */
export function Heatmap({ minutesByDay, today, weeks = 16 }: { minutesByDay: Map<string, number>; today: string; weeks?: number }) {
  const [y, m, d] = today.split('-').map(Number);
  const dow = (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7; // 0 = Monday
  const start = addDays(today, -dow - (weeks - 1) * 7);
  const S = 14;
  const G = 3;
  const cells = [];
  for (let w = 0; w < weeks; w++) {
    for (let r = 0; r < 7; r++) {
      const day = addDays(start, w * 7 + r);
      if (day > today) continue;
      const min = minutesByDay.get(day) ?? 0;
      cells.push(
        <rect key={day} x={w * (S + G)} y={r * (S + G)} width={S} height={S} rx={3} className={FILL[level(min)]}>
          <title>{`${day}: ${Math.round(min)} min`}</title>
        </rect>,
      );
    }
  }
  return (
    <svg viewBox={`0 0 ${weeks * (S + G) - G} ${7 * (S + G) - G}`} className="w-full" role="img" aria-label="Aktywność z ostatnich 16 tygodni">
      {cells}
    </svg>
  );
}
