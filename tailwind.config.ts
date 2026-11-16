import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        der: 'rgb(var(--der) / <alpha-value>)',
        die: 'rgb(var(--die) / <alpha-value>)',
        das: 'rgb(var(--das) / <alpha-value>)',
        bg: 'rgb(var(--bg) / <alpha-value>)',
        surface: 'rgb(var(--surface) / <alpha-value>)',
        fg: 'rgb(var(--fg) / <alpha-value>)',
        muted: 'rgb(var(--muted) / <alpha-value>)',
        accent: 'rgb(var(--accent) / <alpha-value>)',
      },
      keyframes: {
        pop: {
          '0%': { opacity: '0', transform: 'translate(-50%, 0) scale(0.6)' },
          '18%': { opacity: '1', transform: 'translate(-50%, 0) scale(1.08)' },
          '30%': { transform: 'translate(-50%, 0) scale(1)' },
          '80%': { opacity: '1', transform: 'translate(-50%, 0) scale(1)' },
          '100%': { opacity: '0', transform: 'translate(-50%, -12px) scale(0.96)' },
        },
      },
      animation: { pop: 'pop 1.6s ease-out both' },
    },
  },
} satisfies Config;
