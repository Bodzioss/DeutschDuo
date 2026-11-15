import { test, expect, type Page } from '@playwright/test';
import { signIn } from './helpers';

async function studyNewCards(page: Page, n: number) {
  await page.getByRole('button', { name: 'Start' }).click();
  for (let i = 0; i < n; i++) {
    await page.getByRole('button', { name: 'Pokaż' }).click();
    await page.waitForTimeout(400); // RatingBar ignores taps right after reveal
    await page.getByRole('button', { name: 'Łatwe' }).click(); // Easy: graduates, not requeued
  }
}

test('study session updates Heute and survives reload', async ({ page }) => {
  await signIn(page);
  await expect(page.getByTestId('new-count')).toHaveText('10');
  await studyNewCards(page, 3);
  await page.getByRole('link', { name: /Przerwij/ }).click();
  await page.reload();
  await expect(page.getByTestId('new-count')).toHaveText('7');
  await expect(page.getByTestId('minutes-today')).toBeVisible();
});

test('word browser search and detail', async ({ page }) => {
  await signIn(page);
  await page.getByRole('navigation').getByText('Słowa').click();
  await page.getByLabel('Szukaj słowa').fill('tisch');
  await page.getByRole('link', { name: /Tisch/ }).first().click();
  await expect(page.getByText('table', { exact: true })).toBeVisible();
});

test('typing card (EN→DE) shows the answer field and umlaut keys', async ({ page }) => {
  await signIn(page);
  await studyNewCards(page, 1);
  // force the unlocked EN→DE card to be due now, then start a session again
  await page.evaluate(async () => {
    const dbs = await indexedDB.databases();
    const name = dbs.map((d) => d.name).find((n) => n?.startsWith('duo-') && n !== 'duo-global')!;
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open(name);
      req.onsuccess = () => {
        const tx = req.result.transaction('cards', 'readwrite');
        const store = tx.objectStore('cards');
        store.openCursor().onsuccess = (e) => {
          const cur = (e.target as IDBRequest<IDBCursorWithValue>).result;
          if (!cur) return;
          if (cur.value.direction === 'en_de') cur.update({ ...cur.value, fsrs: { ...cur.value.fsrs, due: new Date(0).toISOString() } });
          cur.continue();
        };
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      };
    });
  });
  await page.goto('/');
  await page.getByRole('button', { name: /Start|Kontynuuj/ }).click();
  const input = page.getByLabel('Odpowiedź po niemiecku');
  await expect(input).toBeVisible();
  await expect(page.getByText('ä', { exact: true })).toBeVisible();
});

test('works offline after first load', async ({ page, context }) => {
  await signIn(page);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await context.setOffline(true);
  await page.reload();
  await studyNewCards(page, 2);
  await page.getByRole('link', { name: /Przerwij/ }).click();
  await expect(page.getByTestId('new-count')).toHaveText('8');
});
