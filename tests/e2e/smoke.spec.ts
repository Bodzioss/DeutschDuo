import { test, expect } from '@playwright/test';
import { signIn } from './helpers';

test('unauthenticated device lands on pair password', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByLabel('Hasło pary')).toBeVisible();
});

test('wrong pair password shows an error', async ({ page }) => {
  await page.goto('/setup');
  await page.getByLabel('Hasło pary').fill('zle');
  await page.getByRole('button', { name: 'Wejdź' }).click();
  await expect(page.getByRole('alert')).toHaveText('Złe hasło');
});

test('renders shell at 375px', async ({ page }) => {
  await signIn(page);
  await expect(page.getByRole('heading', { name: /Nikola/ })).toBeVisible();
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(scrollWidth).toBeLessThanOrEqual(375);
});

test('loads offline after first visit', async ({ page, context }) => {
  await signIn(page);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('navigation').getByText('Heute')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start' })).toBeVisible();
});
