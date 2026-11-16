import { useEffect, useRef, useState } from 'react';
import type { CardId, Source, Target } from '@/domain/wortpasjans/engine';

const DRAG_START_PX = 10;

export interface DragState {
  source: Source;
  cards: CardId[];
  x: number;
  y: number;
  /** pointer offset inside the grabbed card, so the card does not jump under the finger */
  dx: number;
  dy: number;
  width: number;
}

/** `slot:2` / `col:1` from the nearest [data-drop] under the point (the dragged ghost has pointer-events: none). */
function dropTargetAt(x: number, y: number): Target | null {
  for (const el of document.elementsFromPoint(x, y)) {
    const v = (el as HTMLElement).closest?.('[data-drop]')?.getAttribute('data-drop');
    if (!v) continue;
    const [kind, n] = v.split(':');
    if (kind === 'slot') return { kind: 'slot', slot: Number(n) };
    if (kind === 'col') return { kind: 'column', col: Number(n) };
  }
  return null;
}

/**
 * Drag and drop of cards with pointer events (finger and mouse). A press that moves more than a few pixels becomes a
 * drag; a press that does not stays a tap, so tap-tap keeps working.
 */
export function useCardDrag(onDrop: (source: Source, target: Target) => void) {
  const [drag, setDrag] = useState<DragState | null>(null);
  const pending = useRef<(Omit<DragState, 'x' | 'y'> & { startX: number; startY: number; active: boolean }) | null>(null);
  const justDropped = useRef(false);
  const dropRef = useRef(onDrop);
  dropRef.current = onDrop;

  useEffect(() => {
    const move = (e: PointerEvent) => {
      const p = pending.current;
      if (!p) return;
      if (!p.active && Math.hypot(e.clientX - p.startX, e.clientY - p.startY) < DRAG_START_PX) return;
      p.active = true;
      setDrag({ source: p.source, cards: p.cards, dx: p.dx, dy: p.dy, width: p.width, x: e.clientX, y: e.clientY });
    };
    const end = (e: PointerEvent, drop: boolean) => {
      const p = pending.current;
      pending.current = null;
      if (!p?.active) return;
      setDrag(null);
      // the click that follows the release must not count as a tap
      justDropped.current = true;
      setTimeout(() => (justDropped.current = false), 0);
      const target = drop ? dropTargetAt(e.clientX, e.clientY) : null;
      if (target) dropRef.current(p.source, target);
    };
    const up = (e: PointerEvent) => end(e, true);
    const cancel = (e: PointerEvent) => end(e, false);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
    };
  }, []);

  /** Call from onPointerDown of a draggable card (or run of cards). */
  const press = (e: React.PointerEvent<HTMLElement>, source: Source | null, cards: CardId[]) => {
    if (!source || e.button !== 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    pending.current = { source, cards, startX: e.clientX, startY: e.clientY, dx: e.clientX - rect.left, dy: e.clientY - rect.top, width: rect.width, active: false };
  };

  return { drag, press, wasDrag: () => justDropped.current };
}
