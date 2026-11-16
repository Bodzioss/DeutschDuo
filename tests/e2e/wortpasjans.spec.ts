import { test, expect, type Page } from '@playwright/test';
import { signIn } from './helpers';
import { solve } from '../../src/domain/wortpasjans/solver';
import { applyMove, initialState, type Deal, type GameState, type Move } from '../../src/domain/wortpasjans/engine';

async function tapSource(page: Page, s: GameState, m: Extract<Move, { type: 'move' }>) {
  if (m.from.kind === 'waste') return page.locator('[data-testid=waste] button').click();
  const index = s.columns[m.from.col].faceUp.length - m.from.depth;
  await page.locator(`[data-testid=col-${m.from.col}-up-${index}] button`).click();
}

async function tapTarget(page: Page, s: GameState, m: Extract<Move, { type: 'move' }>) {
  if (m.to.kind === 'slot') return page.locator(`[data-testid=slot-${m.to.slot}]`).click();
  const col = s.columns[m.to.col];
  if (!col.faceDown.length && !col.faceUp.length) return page.locator(`[data-testid=col-${m.to.col}]`).click();
  await page.locator(`[data-testid=col-${m.to.col}-up-${col.faceUp.length - 1}] button`).click();
}

test('Wortpasjans: map → board → solved by taps → summary with stars, next board unlocked', async ({ page }) => {
  await signIn(page);
  await page.getByRole('navigation').getByText('Gra').click();
  await expect(page.getByRole('heading', { name: 'Wortpasjans' })).toBeVisible();
  await page.goto('/game/berlin-1?seed=12345');
  await expect(page.locator('[data-testid=slots]')).toBeVisible();

  const deal = (await page.evaluate(() => (window as unknown as { __duoDeal: Deal }).__duoDeal)) as Deal;
  expect(deal.seed).toBeGreaterThanOrEqual(12345);
  const sol = solve(deal);
  expect(sol.solvable).toBe(true);

  let s = initialState(deal);
  for (const m of sol.moves) {
    if (m.type === 'draw') await page.getByRole('button', { name: /^Stos/ }).click();
    else {
      await tapSource(page, s, m);
      await tapTarget(page, s, m);
    }
    s = applyMove(deal, s, m);
  }

  const summary = page.getByRole('dialog', { name: 'Podsumowanie planszy' });
  await expect(summary).toBeVisible();
  await expect(summary.getByText('Geschafft!')).toBeVisible();
  await expect(summary.getByLabel('3 gwiazdki')).toBeVisible();
  await summary.getByRole('button', { name: 'Mapa' }).click();
  await expect(page.getByRole('link', { name: /Berlin 2, gwiazdki/ })).toBeVisible();
});

test('peek shows the translation and costs a free peek', async ({ page }) => {
  await signIn(page);
  await page.goto('/game/berlin-1?seed=777');
  const firstWord = page.locator('[data-testid^=col-][data-testid*=-up-] button[aria-label]:not([aria-label^="Kategoria"])').first();
  await expect(firstWord).toBeVisible();
  await firstWord.click();
  await page.getByRole('button', { name: /Podejrzyj/ }).click();
  const sheet = page.getByRole('dialog', { name: 'Podgląd słowa' });
  await expect(sheet).toBeVisible();
  await sheet.getByRole('button', { name: 'OK' }).click();
  await expect(page.getByLabel('Darmowe podglądy')).toHaveText('👁 2');
});
