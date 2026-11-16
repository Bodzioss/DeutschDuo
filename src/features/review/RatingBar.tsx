import { useRef } from 'react';
import type { Grade } from '@/domain/types';

/** Taps this soon after the bar appears are ignored (a double tap on "Pokaż" must not rate the card). */
const TAP_GUARD_MS = 350;

const GRADES: { g: Grade; label: string; cls: string }[] = [
  { g: 1, label: 'Nie pamiętam', cls: 'bg-die/15 text-die' },
  { g: 2, label: 'Trudne', cls: 'bg-amber-500/15 text-amber-600 dark:text-amber-400' },
  { g: 3, label: 'Dobrze', cls: 'bg-das/15 text-das' },
  { g: 4, label: 'Łatwe', cls: 'bg-der/15 text-der' },
];

export function RatingBar({ onRate, suggested, hints }: { onRate: (g: Grade) => void; suggested?: Grade | null; hints?: Record<Grade, string> | null }) {
  const shownAt = useRef(Date.now());
  return (
    <div className="grid grid-cols-4 gap-2">
      {GRADES.map(({ g, label, cls }) => (
        <button
          key={g}
          type="button"
          onClick={() => Date.now() - shownAt.current >= TAP_GUARD_MS && onRate(g)}
          className={`rounded-xl px-1 py-3 text-xs font-semibold active:scale-95 ${cls} ${suggested === g ? 'ring-2 ring-current' : ''}`}
        >
          {label}
          {hints && <span className="mt-0.5 block text-[11px] font-normal opacity-80">{hints[g]}</span>}
        </button>
      ))}
    </div>
  );
}
