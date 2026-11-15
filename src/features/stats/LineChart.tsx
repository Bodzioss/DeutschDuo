/** Minimal responsive SVG line chart (no library). */
export function LineChart({ values, label }: { values: number[]; label: string }) {
  const W = 320;
  const H = 120;
  const P = 6;
  const max = Math.max(1, ...values);
  const x = (i: number) => P + (i * (W - 2 * P)) / Math.max(1, values.length - 1);
  const y = (v: number) => H - P - (v / max) * (H - 2 * P);
  const d = values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-32 w-full" role="img" aria-label={label}>
      <line x1={P} x2={W - P} y1={H - P} y2={H - P} className="stroke-muted/30" strokeWidth={1} />
      {values.length > 1 && <path d={`${d} L${x(values.length - 1)},${H - P} L${P},${H - P} Z`} className="fill-accent/10" />}
      {values.length > 1 && <path d={d} fill="none" className="stroke-accent" strokeWidth={2} strokeLinejoin="round" />}
      <text x={W - P} y={y(values[values.length - 1] ?? 0) - 6} textAnchor="end" className="fill-fg text-[11px]">
        {values[values.length - 1] ?? 0}
      </text>
    </svg>
  );
}
