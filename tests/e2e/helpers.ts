import { expect, type Page } from '@playwright/test';

/** Signs into the fake pair account and picks a profile. */
export async function signIn(page: Page, profile = 'Nikola') {
  await page.goto('/');
  await page.getByLabel('Hasło pary').fill('test');
  await page.getByRole('button', { name: 'Wejdź' }).click();
  await page.getByRole('button', { name: profile }).click();
  await expect(page.getByRole('navigation').getByText('Heute')).toBeVisible();
}
