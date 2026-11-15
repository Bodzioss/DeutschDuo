import { test, expect } from '@playwright/test';

test('renders shell at 375px', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('navigation').getByText('Heute')).toBeVisible();
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(scrollWidth).toBeLessThanOrEqual(375);
});

test('loads offline after first visit', async ({ page, context }) => {
  await page.goto('/');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  // wait until the SW controls the page (first load is uncontrolled)
  await page.reload();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('navigation').getByText('Heute')).toBeVisible();
});
