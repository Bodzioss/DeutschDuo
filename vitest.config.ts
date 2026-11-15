import { defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'node:url';

process.env.TZ = 'Europe/Warsaw';

export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    include: ['tests/unit/**/*.test.{ts,tsx}'],
    environment: 'jsdom',
    setupFiles: ['tests/unit/setup.ts'],
  },
});
