import { useRef, type ReactNode } from 'react';
import type { Word } from '@/domain/types';
import { GenderWord } from '@/ui/GenderWord';

const DOUBLE_TAP_MS = 350;

/** A tap → onTap; a second tap on the same card within a moment → onDoubleTap (instead of a second onTap). */
function useTaps(onTap: () => void, onDoubleTap?: () => void) {
  const last = useRef(0);
  return {
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
    onClick: () => {
      const now = Date.now();
      if (onDoubleTap && now - last.current < DOUBLE_TAP_MS) {
        last.current = 0;
        onDoubleTap();
        return;
      }
      last.current = now;
      onTap();
    },
  };
}

const frame = (selected: boolean) => (selected ? 'ring-2 ring-accent -translate-y-1' : '');

export function CardBack({ offset = false }: { offset?: boolean }) {
  return <div aria-hidden className={`h-5 rounded-t-lg border border-muted/30 bg-gradient-to-br from-accent/40 to-accent/20 ${offset ? '' : ''}`} />;
}

export function WordCard({ word, selected, stacked, onTap, onDoubleTap }: { word: Word; selected?: boolean; stacked?: boolean; onTap: () => void; onDoubleTap?: () => void }) {
  return (
    <button
      type="button"
      {...useTaps(onTap, onDoubleTap)}
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
