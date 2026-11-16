import { test, expect } from '@playwright/test';
import { signIn } from './helpers';

test('settings shows the notifications section (unavailable in the fake build), no horizontal scroll', async ({ page }) => {
  await signIn(page);
  await page.getByRole('navigation').getByText('Ustawienia').click();
  await expect(page.getByRole('heading', { name: 'Powiadomienia' })).toBeVisible();
  await expect(page.getByText('Powiadomienia nie są dostępne w tej wersji.')).toBeVisible();
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(scrollWidth).toBeLessThanOrEqual(375);
});
