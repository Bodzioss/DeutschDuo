import { test, expect } from '@playwright/test';
import { signIn } from './helpers';

test('new phone: progress comes back from the cloud after password + profile', async ({ page }) => {
  await signIn(page);
  await page.getByRole('button', { name: 'Start' }).click();
  for (let i = 0; i < 4; i++) {
    await page.getByRole('button', { name: 'Pokaż' }).click();
    await page.getByRole('button', { name: 'Łatwe' }).click();
  }
  await page.getByRole('link', { name: /Przerwij/ }).click();
  await expect(page.getByTestId('new-count')).toHaveText('6');

  // wait until the background sync pushed everything to the (fake) cloud
  await expect
    .poll(() => page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('duo-fake-cloud') ?? '{}').reviews ?? {}).length))
    .toBeGreaterThan(0);
  await expect
    .poll(() =>
      page.evaluate(() => {
        const cloud = JSON.parse(localStorage.getItem('duo-fake-cloud') ?? '{}');
        return Object.values(cloud.reviews ?? {}).reduce((n: number, t) => n + Object.keys(t as object).length, 0);
      }),
    )
    .toBe(4);

  // "new phone": wipe everything local except the fake cloud
  await page.evaluate(async () => {
    const cloud = localStorage.getItem('duo-fake-cloud');
    localStorage.clear();
    if (cloud) localStorage.setItem('duo-fake-cloud', cloud);
    for (const db of await indexedDB.databases()) if (db.name) indexedDB.deleteDatabase(db.name);
  });
  await page.goto('/');
  await page.getByLabel('Hasło pary').fill('test');
  await page.getByRole('button', { name: 'Wejdź' }).click();
  await page.getByRole('button', { name: 'Nikola' }).click();
  await expect(page.getByTestId('new-count')).toHaveText('6');
});
