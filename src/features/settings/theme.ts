export type Theme = 'system' | 'light' | 'dark';
const KEY = 'duo-theme';

export function getTheme(): Theme {
  try {
    return (localStorage.getItem(KEY) as Theme | null) ?? 'system';
  } catch {
    return 'system';
  }
}

export function applyTheme(t: Theme): void {
  try {
    localStorage.setItem(KEY, t);
  } catch {
    /* private mode: theme just won't persist */
  }
  const dark = t === 'dark' || (t === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
}
