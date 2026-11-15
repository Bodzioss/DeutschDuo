import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost';
const styles: Record<Variant, string> = {
  primary: 'bg-accent text-white shadow',
  secondary: 'bg-surface text-fg ring-1 ring-muted/30',
  ghost: 'text-muted',
};

export function Button({ variant = 'primary', className = '', ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type="button"
      {...rest}
      className={`rounded-xl px-4 py-3 font-semibold transition active:scale-[0.98] disabled:opacity-50 ${styles[variant]} ${className}`}
    />
  );
}
