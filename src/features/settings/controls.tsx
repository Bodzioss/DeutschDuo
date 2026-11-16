import type { ReactNode } from 'react';

export function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-2 px-4 py-3">
      <p className="text-sm font-medium">{label}</p>
      {children}
    </div>
  );
}

export function Segmented<T extends string | number>({ value, options, onChange }: { value: T; options: { v: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="flex rounded-xl bg-muted/10 p-1">
      {options.map((o) => (
        <button
          key={String(o.v)}
          type="button"
          onClick={() => onChange(o.v)}
          className={`flex-1 rounded-lg py-2 text-sm ${o.v === value ? 'bg-surface font-semibold shadow-sm' : 'text-muted'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
