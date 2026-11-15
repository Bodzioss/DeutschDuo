import { expect, test } from 'vitest';

test('test env runs in Europe/Warsaw', () => {
  expect(process.env.TZ).toBe('Europe/Warsaw');
});
