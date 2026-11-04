/**
 * Reading experience (owner decisions O11, O12): no per-page AI badge but an
 * AI line in every footer; sections open by default with "Continue" links;
 * A-/A+ reading size remembered and applied before paint; reading progress;
 * section chips that follow the scroll; differential tables in a labelled
 * scroll region; form fields never below 16 px (no iOS zoom).
 */
import { expect, test } from '@playwright/test';

const ENTITY = 'it/e/apoptosis/';
const PATTERN = 'en/pattern/p01-necrosis/';
const width = () => test.info().project.metadata.width as number;

test.use({ reducedMotion: 'reduce' });

test('no AI badge on entity and pattern pages; the footer carries the AI line @smoke', async ({ page }) => {
  for (const [path, text, method] of [
    [ENTITY, /Testi redatti con l’aiuto dell’intelligenza artificiale/, /\/it\/about\/method\/$/],
    [PATTERN, /Texts drafted with AI assistance/, /\/en\/about\/method\/$/],
  ] as const) {
    await page.goto(path);
    await expect(page.locator('main'), path).not.toContainText(/Generato con IA|AI-generated|non ancora revisionato|not yet reviewed/);
    const line = page.locator('footer [data-ai-notice]');
    await expect(line, path).toContainText(text);
    expect(await line.locator('a').getAttribute('href'), path).toMatch(method);
  }
  await page.goto('it/');
  await expect(page.locator('footer [data-ai-notice]')).toBeVisible();
});

test('sections are open by default, end with "Continue", and the reading controls still work @smoke', async ({ page }) => {
  await page.goto(ENTITY);
  const toggles = page.locator('[data-section-toggle]');
  expect(await toggles.count()).toBeGreaterThan(10);
  for (const t of await toggles.all()) await expect(t).toHaveAttribute('aria-expanded', 'true');

  // Full mode: definition continues to etiology.
  const next = page.locator('#definition .section-next a:visible');
  await expect(next).toHaveCount(1);
  await expect(next).toHaveAttribute('href', '#etiology');
  // Quick mode: definition continues to the next quick section, and the target is visible.
  await page.locator('[data-mode-btn="quick"]').click();
  await expect(page.locator('#etiology')).toBeHidden();
  await expect(next).toHaveAttribute('href', '#differential');
  await next.click();
  await expect(page.locator('#differential')).toBeInViewport();
  await page.locator('[data-mode-btn="full"]').click();

  // Collapse all / expand all.
  const all = page.locator('[data-expand-all]');
  await all.click();
  for (const t of await toggles.all()) await expect(t).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('#micro-body')).toBeHidden();
  await all.click();
  await expect(page.locator('#micro-body')).toBeVisible();
});

test('A-/A+ changes the reading size, is keyboard operable and is applied before paint on reload @smoke', async ({ page }) => {
  await page.goto(ENTITY);
  const html = page.locator('html');
  const fontSize = () => page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('.section-body p')!).fontSize));
  const before = await fontSize();
  const larger = page.locator('.entity-head [data-text-step="1"]');
  await larger.focus();
  await page.keyboard.press('Enter');
  await expect(html).toHaveClass(/\btext-l\b/);
  await expect(page.locator('.entity-head [data-text-size-status]')).toHaveText(/3/);
  await expect.poll(fontSize).toBeGreaterThan(before);
  await page.keyboard.press('Enter');
  await expect(html).toHaveClass(/\btext-xl\b/);
  await expect(larger).toHaveAttribute('aria-disabled', 'true');

  // The class is on <html> before any module script runs (inline head script).
  await page.addInitScript(() => {
    document.addEventListener('readystatechange', () => {
      if (document.readyState === 'interactive') (window as unknown as { __early: string }).__early = document.documentElement.className;
    });
  });
  await page.reload();
  expect(await page.evaluate(() => (window as unknown as { __early: string }).__early)).toMatch(/\btext-xl\b/);

  const smaller = page.locator('.entity-head [data-text-step="-1"]');
  for (let i = 0; i < 3; i++) await smaller.click();
  await expect(html).toHaveClass(/\btext-s\b/);
  await expect(smaller).toHaveAttribute('aria-disabled', 'true');
  await smaller.dispatchEvent('click'); // no-op at the end of the range (Playwright will not click aria-disabled)
  await expect(html).toHaveClass(/\btext-s\b/);

  // Even at the smallest size, form fields stay >= 16 px (iOS would zoom in).
  await page.goto('it/search/');
  const field = page.locator('main input[type="search"]').first();
  expect(await field.evaluate((el) => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16);
});

test('reading progress and the section chips follow the scroll', async ({ page }) => {
  await page.goto(ENTITY);
  const bar = page.locator('[data-read-progress]');
  const scale = () => bar.evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).a);
  expect(await scale()).toBeLessThan(0.05);
  await page.evaluate(() => document.getElementById('pathogenesis')!.scrollIntoView());
  await expect(page.locator('.section-toc a[href="#pathogenesis"]')).toHaveAttribute('aria-current', 'true');
  await expect(page.locator('.section-toc a[aria-current]')).toHaveCount(1);
  await expect.poll(scale).toBeGreaterThan(0.1);
  await page.evaluate(() => document.getElementById('traps')!.scrollIntoView());
  await expect(page.locator('.section-toc a[href="#traps"]')).toHaveAttribute('aria-current', 'true');
  if (width() < 1024) await expect(page.locator('.section-toc a[href="#traps"]')).toBeInViewport();
});

test('the differential table scrolls inside a labelled region with a sticky first column on phones', async ({ page }) => {
  await page.goto(ENTITY);
  const region = page.locator('#differential .table-scroll');
  await expect(region).toHaveAttribute('role', 'region');
  await expect(region).toHaveAttribute('tabindex', '0');
  await expect(region).toHaveAttribute('aria-label', /Diagnosi differenziale/);
  const firstCell = region.locator('tbody tr:first-child > :first-child');
  expect(await firstCell.evaluate((el) => getComputedStyle(el).position)).toBe(width() < 600 ? 'sticky' : 'static');
});
