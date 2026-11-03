import { expect, test, type Page } from '@playwright/test';

/** Wait until the service worker is active (shell precached) and controls the page. */
async function swReady(page: Page) {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller)
      await new Promise((r) => navigator.serviceWorker.addEventListener('controllerchange', r, { once: true }));
  });
}

test('after the first visit, the home pages and the offline fallback load offline', async ({ page, context }) => {
  await page.goto('it/');
  await swReady(page);
  await context.setOffline(true);

  await page.goto('it/');
  await expect(page).toHaveTitle('Atlante di Patologia');
  await expect(page.locator('html')).toHaveAttribute('lang', 'it');

  await page.goto('en/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');

  await page.goto('it/offline/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Sei offline');

  // A page that was never saved falls back to the offline page in its language.
  await page.goto('en/atlas/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('You are offline');
  await page.goto('it/about/method/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Sei offline');
});

test('an installed offline pack makes its pages load offline', async ({ page, context }) => {
  await page.goto('it/me/offline/');
  await swReady(page);
  const pack = page.locator('[data-pack="g01"]');
  await expect(pack.locator('[data-state]')).toHaveText('Non scaricato');
  await pack.getByRole('button', { name: /^Scarica / }).click();
  await expect(pack.locator('[data-state]')).toHaveText('Disponibile offline');
  await expect(pack.getByRole('button', { name: /^Rimuovi / })).toBeVisible();

  await context.setOffline(true);
  await page.goto('it/e/fixture-demo/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Voce di prova');
  // Packs are per language: the English pack was not installed.
  await page.goto('en/e/fixture-demo/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('You are offline');

  // Removing the pack (back online) takes its pages away again.
  await context.setOffline(false);
  await page.goto('it/me/offline/');
  await page.locator('[data-pack="g01"]').getByRole('button', { name: /^Rimuovi / }).click();
  await expect(page.locator('[data-pack="g01"] [data-state]')).toHaveText('Non scaricato');
  await context.setOffline(true);
  await page.goto('it/e/fixture-demo/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Sei offline');
});
