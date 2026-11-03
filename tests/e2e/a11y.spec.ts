/** axe-core on every page template, light and dark (NAVIGATION_SPEC §7). */
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { TEMPLATES } from './pages.ts';

const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const SMOKE = new Set(['home-it', 'atlas', 'search', 'not-found']);

async function audit(page: Page) {
  const { violations } = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  return violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`);
}

for (const scheme of ['light', 'dark'] as const) {
  for (const [name, path] of Object.entries(TEMPLATES)) {
    test(`${name} has no axe violations (${scheme})${SMOKE.has(name) ? ' @smoke' : ''}`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
      await page.goto(path);
      if (name === 'search') await expect(page.locator('[data-search-status]')).not.toHaveText(/^$|…/);
      expect(await audit(page)).toEqual([]);
    });
  }
}

// axe needs JavaScript, so the root page is audited with its redirect script
// stripped: that is exactly what a visitor without JavaScript sees.
for (const scheme of ['light', 'dark'] as const) {
  test(`root language picker (no-JS view) has no axe violations (${scheme}) @smoke`, async ({ page }) => {
    await page.route(/\/atlante-patologia\/$/, async (route) => {
      const res = await route.fetch();
      const body = (await res.text()).replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '');
      await route.fulfill({ response: res, body });
    });
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto('./');
    await expect(page.getByRole('link', { name: /English/ })).toBeVisible();
    expect(await audit(page)).toEqual([]);
  });
}
