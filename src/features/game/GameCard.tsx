import { useRef, type ReactNode } from 'react';
import type { Word } from '@/domain/types';
import { GenderWord } from '@/ui/GenderWord';

const DOUBLE_TAP_MS = 350;

/** Card height and how far a card under another one is covered (only its top strip stays visible). */
export const CARD_H = 'h-[4.5rem]';
export const STACK_OVERLAP = '-mb-[3rem]';

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

const base = `relative w-full select-none overflow-hidden rounded-xl transition duration-150 [-webkit-touch-callout:none] ${CARD_H}`;
const lift = (selected: boolean) => (selected ? '-translate-y-1.5 shadow-lift ring-2 ring-accent' : 'shadow-card');
const stripe = { der: 'bg-der', die: 'bg-die', das: 'bg-das' } as const;

export function WordCard({ word, selected, stacked, onTap, onDoubleTap }: { word: Word; selected?: boolean; stacked?: boolean; onTap: () => void; onDoubleTap?: () => void }) {
  return (
    <button
      type="button"
      {...useTaps(onTap, onDoubleTap)}
      aria-label={`${word.article ? word.article + ' ' : ''}${word.de}`}
      aria-pressed={selected}
      className={`${base} ${lift(!!selected)} flex justify-center bg-surface px-1 text-center text-[13px] leading-tight ring-1 ring-muted/15 ${stacked ? 'items-start pt-2' : 'items-center pt-1'}`}
    >
      {/* gender stripe: der blue, die red, das green, grey for words without an article */}
      <span aria-hidden className={`absolute inset-x-0 top-0 h-1 ${word.article ? stripe[word.article] : 'bg-muted/40'}`} />
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
      className={`${base} ${lift(!!selected)} flex flex-col items-center bg-gradient-to-br from-accent to-accent/75 px-1.5 text-center leading-tight text-white ${stacked ? 'justify-start pt-1.5' : 'justify-center'}`}
    >
      <span aria-hidden className="text-[8.5px] font-semibold uppercase tracking-[0.12em] opacity-75">Kategorie</span>
      <span lang="de" className="hyphens-auto text-[12.5px] font-bold">{label}</span>
      {!stacked && <span className="truncate text-[10px] opacity-80">{hint}</span>}
      {children}
    </button>
  );
}

/** A category in its slot, with how many of its words are already in. */
export function SlotCategory({ label, hint, count, size, onTap }: { label: string; hint: string; count: number; size: number; onTap: () => void }) {
  return (
    <CategoryCard label={label} hint={hint} onTap={onTap}>
      <span className="mt-1 flex w-full items-center gap-1 px-0.5">
        <span className="h-1 flex-1 overflow-hidden rounded-full bg-white/25">
          <span className="block h-full rounded-full bg-white transition-[width] duration-300" style={{ width: `${(count / size) * 100}%` }} />
        </span>
        <span className="text-[10px] font-semibold tabular-nums">{count}/{size}</span>
      </span>
    </CategoryCard>
  );
}

export function EmptySlot({ index, onTap }: { index: number; onTap: () => void }) {
  return (
    <button type="button" data-testid={`slot-${index}`} data-drop={`slot:${index}`} onClick={onTap} aria-label="Wolne pole kategorii"
      className={`${CARD_H} flex w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-accent/30 bg-accent/[0.04] text-accent/70`}>
      <span aria-hidden className="text-lg leading-none">＋</span>
      <span className="text-[10px] font-medium">kategoria</span>
    </button>
  );
}

/** Edge of a face-down card in a column. */
export function CardBack() {
  return <div aria-hidden className="card-back -mb-1 h-5 rounded-t-xl ring-1 ring-black/10" />;
}

export function Deck({ count, onTap }: { count: number; onTap: () => void }) {
  return (
    <button type="button" onClick={onTap} aria-label={`Stos: ${count} kart`}
      className={`${CARD_H} relative w-full rounded-xl transition active:scale-95 ${count ? 'card-back shadow-card ring-1 ring-black/10' : 'border-2 border-dashed border-muted/30'}`}>
      {count ? (
        <>
          <span className="absolute right-1 top-1 rounded-full bg-surface px-1.5 text-[11px] font-bold tabular-nums text-accent shadow-sm">{count}</span>
        </>
      ) : (
        <span className="text-xl text-muted" aria-hidden>↺</span>
      )}
    </button>
  );
}
