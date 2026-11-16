import { useRef, type ReactNode } from 'react';
import type { Word } from '@/domain/types';
import { GenderWord } from '@/ui/GenderWord';

const LONG_PRESS_MS = 450;

/** Long press (touch or mouse) → onLongPress; a normal tap → onTap. */
function usePress(onTap: () => void, onLongPress?: () => void) {
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const long = useRef(false);
  return {
    onPointerDown: () => {
      long.current = false;
      if (onLongPress) timer.current = setTimeout(() => ((long.current = true), onLongPress()), LONG_PRESS_MS);
    },
    onPointerUp: () => clearTimeout(timer.current),
    onPointerLeave: () => clearTimeout(timer.current),
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
    onClick: () => {
      if (!long.current) onTap();
    },
  };
}

const frame = (selected: boolean, target: boolean) =>
  `${selected ? 'ring-2 ring-accent -translate-y-1' : ''} ${target ? 'ring-2 ring-das ring-offset-1 ring-offset-bg' : ''}`;

export function CardBack({ offset = false }: { offset?: boolean }) {
  return <div aria-hidden className={`h-5 rounded-t-lg border border-muted/30 bg-gradient-to-br from-accent/40 to-accent/20 ${offset ? '' : ''}`} />;
}

export function WordCard({ word, selected, target, onTap, onLongPress }: { word: Word; selected?: boolean; target?: boolean; onTap: () => void; onLongPress?: () => void }) {
  return (
    <button
      type="button"
      {...usePress(onTap, onLongPress)}
      aria-label={`${word.article ? word.article + ' ' : ''}${word.de}`}
      aria-pressed={selected}
      className={`flex min-h-[3.25rem] w-full select-none items-center justify-center rounded-lg border border-muted/25 bg-surface px-1 py-1.5 text-center text-[13px] leading-tight shadow-sm transition ${frame(!!selected, !!target)}`}
    >
      <GenderWord word={word} className="break-words" />
    </button>
  );
}

export function CategoryCard({ label, hint, selected, target, onTap, children }: { label: string; hint: string; selected?: boolean; target?: boolean; onTap: () => void; children?: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onTap}
      aria-label={`Kategoria: ${label}`}
      aria-pressed={selected}
      className={`flex min-h-[3.25rem] w-full select-none flex-col items-center justify-center rounded-lg border-2 border-dashed border-accent/60 bg-accent/10 px-1 py-1 text-center leading-tight transition ${frame(!!selected, !!target)}`}
    >
      <span className="text-[12px] font-semibold text-accent">📂 {label}</span>
      <span className="text-[10px] text-muted">{hint}</span>
      {children}
    </button>
  );
}
