import type { RefObject } from 'react';

const CHARS = ['ä', 'ö', 'ü', 'ß'];

/** Inserts German characters at the caret of the given input. */
export function UmlautBar({ inputRef, value, onChange }: { inputRef: RefObject<HTMLInputElement>; value: string; onChange: (v: string) => void }) {
  const insert = (ch: string) => {
    const el = inputRef.current;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    onChange(value.slice(0, start) + ch + value.slice(end));
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + 1, start + 1);
    });
  };
  return (
    <div className="flex gap-2">
      {CHARS.map((c) => (
        <button
          key={c}
          type="button"
          onPointerDown={(e) => e.preventDefault()}
          onClick={() => insert(c)}
          className="h-10 flex-1 rounded-lg bg-surface text-lg shadow-sm ring-1 ring-muted/20 active:scale-95"
        >
          {c}
        </button>
      ))}
    </div>
  );
}
