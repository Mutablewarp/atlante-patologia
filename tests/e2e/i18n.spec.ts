/**
 * Language entry and switch (D027, NAVIGATION_SPEC §5): with JavaScript the
 * root redirects by saved choice → navigator.languages → Italian; without
 * JavaScript it offers two links; the IT/EN switch keeps page, ?query, #hash.
 */
import { expect, test } from '@playwright/test';

const BASE = '/atlante-patologia/';
const onlyAt = (...widths: number[]) =>
  test.skip(!widths.includes(test.info().project.metadata.width as number), `runs at ${widths.join(', ')}px only`);

test.describe('root redirect', () => {
  for (const [languages, expected] of [
    [['en-GB'], 'en'],
    [['it-IT', 'en'], 'it'],
    [['de-DE'], 'it'],
    [['fr-FR', 'en-US', 'it'], 'en'],
  ] as const) {
    test(`navigator.languages ${languages.join(',')} → /${expected}/${expected === 'en' ? ' @smoke' : ''}`, async ({ page }) => {
      onlyAt(1280);
      await page.addInitScript((langs) => {
        Object.defineProperty(navigator, 'languages', { get: () => langs });
      }, languages as unknown as string[]);
      await page.goto('./');
      await expect(page).toHaveURL(new RegExp(`${BASE}${expected}/$`));
    });
  }

  test('a saved explicit choice wins over the browser languages', async ({ page }) => {
    onlyAt(1280);
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'languages', { get: () => ['it-IT'] });
      localStorage.setItem('ap-lang', 'en');
    });
    await page.goto('./');
    await expect(page).toHaveURL(new RegExp(`${BASE}en/$`));
  });
});

test.describe('root without JavaScript', () => {
  test.use({ javaScriptEnabled: false });
  test('shows a link to each language @smoke', async ({ page }) => {
    onlyAt(375, 1280);
    await page.goto('./');
    await expect(page).toHaveURL(new RegExp(`${BASE}$`));
    await expect(page.locator(`a[hreflang="it"][href="${BASE}it/"]`)).toBeVisible();
    await expect(page.locator(`a[hreflang="en"][href="${BASE}en/"]`)).toBeVisible();
  });
});

test.describe('language switch', () => {
  for (const [from, to] of [
    ['it/atlas/system/', 'en/atlas/system/'],
    ['en/about/reading-list/', 'it/about/reading-list/'],
    ['it/search/?q=atlante', 'en/search/?q=atlante'],
    ['en/about/roadmap/#g01', 'it/about/roadmap/#g01'],
  ] as const) {
    test(`${from} → ${to}${from.includes('?') ? ' @smoke' : ''}`, async ({ page }) => {
      onlyAt(375, 1280);
      await page.goto(from);
      const target = to.slice(0, 2);
      await page.locator(`.lang-switch a[hreflang="${target}"]`).click();
      await expect(page).toHaveURL(`${BASE}${to}`);
      await expect(page.locator('html')).toHaveAttribute('lang', target);
    });
  }

  test('on the 404 page it leads to the other language home', async ({ page }) => {
    onlyAt(1280);
    await page.goto('it/pagina-inesistente/');
    const link = page.locator('.lang-switch a[hreflang="en"]');
    await expect(link).toHaveAttribute('href', `${BASE}en/`);
    await expect(link).toContainText('English home page');
  });
});
