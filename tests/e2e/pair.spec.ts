import { test, expect, type Page } from '@playwright/test';
import { signIn } from './helpers';
import { solve } from '../../src/domain/wortpasjans/solver';
import { applyMove, initialState, type Deal, type GameState, type Move } from '../../src/domain/wortpasjans/engine';

const getDeal = (page: Page) => page.evaluate(() => (window as unknown as { __duoDeal: Deal }).__duoDeal) as Promise<Deal>;

async function play(page: Page, deal: Deal) {
  const tapSource = async (s: GameState, m: Extract<Move, { type: 'move' }>) => {
    if (m.from.kind === 'waste') return page.locator('[data-testid=waste] button').click();
    // cards under the top one are partly covered: tap their visible top strip, like a player would
    await page.locator(`[data-testid=col-${m.from.col}-up-${s.columns[m.from.col].faceUp.length - m.from.depth}] button`).click({ position: { x: 20, y: 8 } });
  };
  const tapTarget = async (s: GameState, m: Extract<Move, { type: 'move' }>) => {
    if (m.to.kind === 'slot') return page.locator(`[data-testid=slot-${m.to.slot}]`).click();
    const col = s.columns[m.to.col];
    if (!col.faceDown.length && !col.faceUp.length) return page.locator(`[data-testid=col-${m.to.col}]`).click();
    await page.locator(`[data-testid=col-${m.to.col}-up-${col.faceUp.length - 1}] button`).click();
  };
  let s = initialState(deal);
  for (const m of solve(deal).moves) {
    if (m.type === 'draw') await page.getByRole('button', { name: /^Stos/ }).click();
    else {
      await tapSource(s, m);
      await tapTarget(s, m);
    }
    s = applyMove(deal, s, m);
  }
}

test('league shows both players; the duel board is identical for both and the result waits for the partner', async ({ page }) => {
  test.setTimeout(120_000);
  await signIn(page, 'Nikola');
  await expect(page.getByTestId('league-card')).toBeVisible();
  await page.getByTestId('league-card').click();
  const table = page.getByRole('region', { name: 'Tabela ligi' }).or(page.getByLabel('Tabela ligi'));
  await expect(table.getByText('Nikola (Ty)')).toBeVisible();
  await expect(table.getByText('Marcin')).toBeVisible();

  await page.getByRole('link', { name: 'Zagraj pojedynek' }).click();
  await expect(page.getByRole('button', { name: /Pojedynek/ })).toBeVisible();
  const nikolaDeal = await getDeal(page);
  const duelUrl = page.url();

  // Marcin on the same device sees exactly the same board
  await page.goto('/who');
  await page.getByRole('button', { name: 'Marcin' }).click();
  // the choice is saved before the picker navigates away; a reload before that would reopen Nikola
  await expect(page).not.toHaveURL(/\/who/);
  await page.goto(duelUrl);
  await expect(page.getByRole('button', { name: /Pojedynek/ })).toBeVisible();
  expect(await getDeal(page)).toEqual(nikolaDeal);

  // Marcin plays and wins; the league then waits for Nikola
  await play(page, await getDeal(page));
  const summary = page.getByRole('dialog', { name: 'Podsumowanie planszy' });
  await expect(summary.getByText('Geschafft!')).toBeVisible();
  await summary.getByRole('button', { name: /Zobacz wynik pojedynku/ }).click();
  await expect(page.getByText('Czekamy na wynik: Nikola.')).toBeVisible();
});
