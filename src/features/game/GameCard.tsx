import { useRef, type ReactNode } from 'react';
import type { Word } from '@/domain/types';
import { GenderWord } from '@/ui/GenderWord';

const LONG_PRESS_MS = 450;

const MOVE_TOLERANCE_PX = 10;

/** Long press (touch or mouse) → onLongPress; a normal tap → onTap. Scrolling or moving the finger cancels the press. */
function usePress(onTap: () => void, onLongPress?: () => void) {
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const long = useRef(false);
  const start = useRef<{ x: number; y: number } | null>(null);
  const cancel = () => {
    clearTimeout(timer.current);
    start.current = null;
  };
  return {
    onPointerDown: (e: React.PointerEvent) => {
      long.current = false;
      start.current = { x: e.clientX, y: e.clientY };
      if (onLongPress) timer.current = setTimeout(() => ((long.current = true), onLongPress()), LONG_PRESS_MS);
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (start.current && Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > MOVE_TOLERANCE_PX) cancel();
    },
    onPointerUp: () => clearTimeout(timer.current),
    onPointerLeave: cancel,
    onPointerCancel: cancel,
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
    onClick: () => {
      if (!long.current) onTap();
    },
  };
}

const frame = (selected: boolean) => (selected ? 'ring-2 ring-accent -translate-y-1' : '');

export function CardBack({ offset = false }: { offset?: boolean }) {
  return <div aria-hidden className={`h-5 rounded-t-lg border border-muted/30 bg-gradient-to-br from-accent/40 to-accent/20 ${offset ? '' : ''}`} />;
}

export function WordCard({ word, selected, stacked, onTap, onLongPress }: { word: Word; selected?: boolean; stacked?: boolean; onTap: () => void; onLongPress?: () => void }) {
  return (
    <button
      type="button"
      {...usePress(onTap, onLongPress)}
      aria-label={`${word.article ? word.article + ' ' : ''}${word.de}`}
      aria-pressed={selected}
      className={`flex min-h-[3.25rem] w-full select-none justify-center rounded-lg border border-muted/25 bg-surface px-1 text-center text-[13px] leading-tight shadow-sm transition [-webkit-touch-callout:none] ${stacked ? 'items-start pt-1' : 'items-center py-1.5'} ${frame(!!selected)}`}
    >
      <span lang="de" className="hyphens-auto break-words">
        <GenderWord word={word} />
      </span>
    </button>
  );
}

export function CategoryCard({ label, hint, selected, stacked, onTap, children }: { label: string; hint: string; selected?: boolean; stacked?: boolean; onTap: () => void; children?: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onTap}
      aria-label={`Kategoria: ${label}`}
      aria-pressed={selected}
      className={`flex min-h-[3.25rem] w-full select-none flex-col items-center rounded-lg ${stacked ? 'justify-start pt-0.5' : 'justify-center'} border-2 border-dashed border-accent/60 bg-accent/10 px-1 py-1 text-center leading-tight transition ${frame(!!selected)}`}
    >
      <span lang="de" className="hyphens-auto text-[12px] font-semibold text-accent">📂 {label}</span>
      <span className="text-[10px] text-muted">{hint}</span>
      {children}
    </button>
  );
}
