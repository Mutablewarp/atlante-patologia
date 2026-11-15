/** The body page, tree part (docs/BODY_SPEC.md §5): both languages, chips, counts, planned entries, hash, axe, phone overflow. */
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

for (const lang of ['it', 'en'] as const) {
  test.describe(`body page (${lang})`, () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(`${lang}/body/`);
    });

    test('renders chips, systems and organs', async ({ page }) => {
      await expect(page.locator('h1')).toHaveText(lang === 'it' ? 'Il corpo' : 'The body');
      expect(await page.locator('.body-systems a[data-system]').count()).toBeGreaterThan(0);
      expect(await page.locator('section[data-organ]').count()).toBeGreaterThan(0);
    });

    test('a chip jumps to its system', async ({ page }) => {
      const chips = page.locator('.body-systems a[data-system]');
      const chip = chips.nth((await chips.count()) - 1);
      const id = await chip.getAttribute('data-system');
      await chip.click();
      await expect(page).toHaveURL(new RegExp(`#sys-${id}$`));
      await expect(page.locator(`section#sys-${id}`)).toBeInViewport();
    });

    test('the count of a system equals its number of distinct card links', async ({ page }) => {
      // A card without sites sits under every organ of its system, so one card can have several links in one system.
      const systems = page.locator('ap-body > section[id^="sys-"]');
      for (let i = 0; i < (await systems.count()); i++) {
        const sys = systems.nth(i);
        const id = await sys.getAttribute('data-system');
        const chipCount = Number(await page.locator(`.body-systems a[data-system="${id}"] .count`).innerText());
        const hrefs = await sys.locator('.body-cards a').evaluateAll((as) => as.map((a) => a.getAttribute('href')));
        expect(chipCount, `system ${id}`).toBe(new Set(hrefs).size);
      }
    });

    test('a planned entry has the badge and no link', async ({ page }) => {
      const planned = page.locator('.body-planned li');
      expect(await planned.count()).toBeGreaterThan(0);
      await expect(planned.first().locator('.badge-planned')).toBeVisible();
      await expect(planned.first().locator('a')).toHaveCount(0);
    });

    test('#organ-<id> scrolls that organ into view', async ({ page }) => {
      const organs = page.locator('section[data-organ]');
      const id = await organs.nth((await organs.count()) - 1).getAttribute('data-organ');
      await page.goto(`${lang}/body/#organ-${id}`);
      await expect(page.locator(`#organ-${id}`)).toBeInViewport();
    });

    test('has no axe violations', async ({ page }) => {
      const { violations } = await new AxeBuilder({ page }).withTags(WCAG).analyze();
      expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`)).toEqual([]);
    });
  });
}

test('an organ link on a card lands on the body page with that organ as target', async ({ page }) => {
  await page.goto('en/body/');
  const first = page.locator('section[data-organ]:has(.body-cards a)').first();
  const organ = await first.getAttribute('data-organ');
  await first.locator('.body-cards a').first().click();
  const link = page.locator(`.where-in-body a[href$="body/#organ-${organ}"]`);
  await expect(link).toBeVisible();
  await link.click();
  await expect(page).toHaveURL(new RegExp(`/body/#organ-${organ}$`));
  await expect(page.locator(`#organ-${organ}:target`)).toHaveCount(1);
});

test('each organ with cards shows seen, mastered and due, and a review link filtered to its cards', async ({ page }) => {
  await page.goto('en/body/');
  const organ = page.locator('section[data-organ]:has(.body-cards a)').first();
  const line = organ.locator(':scope > [data-progress]');
  await expect(line.locator('[data-k="seen"]')).toHaveText(/^Seen 0\/\d+$/);
  await expect(line.locator('[data-k="mastered"]')).toHaveText(/^Mastered 0\/\d+$/);
  await expect(line.locator('[data-k="due"]')).toHaveText(/^Due today 0$/);
  await expect(line.locator('a')).toHaveAttribute('href', /study\/review\/\?entities=[a-z0-9-]+/);
});

test('no horizontal overflow at 375 px', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('it/body/');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
