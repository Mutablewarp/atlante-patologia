/**
 * 3D pathways (O9): the 2D stepper, the "Load the 3D view" button, step sync
 * of the 3D highlight, our own controls, no third-party requests, and axe with
 * the viewer open. Without WebGL the poster, description and steps must stay.
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const PAGE = 'it/pathways/intrinsic-apoptosis/';
const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

test.use({ reducedMotion: 'reduce' });
// WebGL rendering is the slow part: one phone and one desktop width are enough.
test.beforeEach(() => test.skip(![375, 1280].includes(test.info().project.metadata.width as number), 'runs at 375 and 1280 px'));

// WebGL draws are slow when many browsers run in parallel.
const GL = { timeout: 20_000 };
const hasWebGL = (page: Page) => page.evaluate(() => !!document.createElement('canvas').getContext('webgl'));

test('the stepper moves the current step, the diagram and the announcement @smoke', async ({ page }) => {
  await page.goto(PAGE);
  const steps = page.locator('[data-step-item]');
  await expect(steps).toHaveCount(10);
  await expect(steps.nth(0)).toHaveAttribute('aria-current', 'step');
  await expect(page.locator('[data-step-box="1"]')).toHaveAttribute('data-state', 'future');
  await page.locator('[data-step-next]').click();
  await expect(steps.nth(1)).toHaveAttribute('aria-current', 'step');
  await expect(steps.nth(0)).not.toHaveAttribute('aria-current', 'step');
  await expect(page.locator('[data-step-box="0"]')).toHaveAttribute('data-state', 'done');
  await expect(page.locator('[data-step-box="1"]')).toHaveAttribute('data-state', 'current');
  await expect(page.locator('[data-step-counter]')).toHaveText('Passo 2 di 10');
  await expect(page.locator('[data-step-status]')).toContainText('Passo 2 di 10');
  // At the first step "previous" stays focusable and does nothing.
  await page.locator('[data-step-prev]').click();
  // aria-disabled now, so Playwright would refuse a click; WebKit does not focus buttons on click.
  await page.locator('[data-step-prev]').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-step-prev]')).toBeFocused();
  await expect(steps.nth(0)).toHaveAttribute('aria-current', 'step');
  await expect(page.locator('[data-step-prev]')).toHaveAttribute('aria-disabled', 'true');
});

test('the 3D view loads on demand, follows the steps and makes no third-party request @smoke', async ({ page, baseURL }) => {
  const origin = new URL(baseURL!).origin;
  const requests: string[] = [];
  page.on('request', (r) => requests.push(r.url()));
  await page.goto(PAGE);
  await page.waitForLoadState('networkidle');
  // Nothing heavy before the click.
  expect(requests.filter((u) => /structure-3d|\.bcif/.test(u))).toEqual([]);
  const viewer = page.locator('ap-structure');
  await expect(viewer.locator('[data-load]')).toHaveText(/Carica la vista 3D \(circa 160 kB\)/);
  await expect(viewer.locator('img[data-poster]:visible')).toHaveCount(1);

  const webgl = await hasWebGL(page);
  await viewer.locator('[data-load]').click();
  if (!webgl) {
    await expect(viewer.locator('[data-fallback]')).toBeVisible();
    await expect(viewer.locator('img[data-poster]:visible')).toHaveCount(1);
    return;
  }
  await expect(viewer).toHaveAttribute('data-loaded', '', GL);
  await expect(viewer.locator('[data-stage]')).toBeFocused();
  await expect(viewer.locator('[data-tools]')).toBeVisible();
  await expect(viewer.locator('canvas')).toHaveCount(1);
  // Step 1 has no structure: the first structured step (3, BCL-2 + venetoclax) is shown.
  await expect(viewer).toHaveAttribute('data-shown', '6o0k:2', GL);
  const venetoclax = Number(await viewer.getAttribute('data-highlight-atoms'));
  expect(venetoclax).toBeGreaterThan(0);

  // The 3D toolbar's own "next" drives the shared stepper: step 2 keeps 6O0K, step 3 shows it, step 4 is BAX.
  const next = viewer.locator('[data-act="next"]');
  await next.click();
  await next.click();
  await expect(page.locator('[data-step-item]').nth(2)).toHaveAttribute('aria-current', 'step');
  await next.click();
  await expect(viewer).toHaveAttribute('data-shown', '1f16:3', GL);
  const helix = Number(await viewer.getAttribute('data-highlight-atoms'));
  expect(helix).toBeGreaterThan(0);
  expect(helix).not.toBe(venetoclax);
  // The diagram and the 3D view stay in step.
  await expect(page.locator('[data-step-box="3"]')).toHaveAttribute('data-state', 'current');

  // Our controls and keys work without throwing.
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  for (const act of ['left', 'right', 'in', 'out', 'reset']) await viewer.locator(`[data-act="${act}"]`).click();
  await viewer.locator('[data-act="labels"]').click();
  await expect(viewer.locator('[data-act="labels"]')).toHaveAttribute('aria-pressed', 'false');
  await viewer.locator('[data-stage]').focus();
  for (const key of ['ArrowLeft', 'ArrowUp', '+', '-', '0']) await page.keyboard.press(key);
  expect(errors).toEqual([]);

  expect(requests.filter((u) => new URL(u).origin !== origin && !/^(data|blob):/.test(u))).toEqual([]);
  expect(requests.some((u) => u.includes('/structures/1f16.bcif.gz'))).toBe(true);
});

test('the pathway page has no axe violations with the 3D view open', async ({ page }) => {
  await page.goto(PAGE);
  if (await hasWebGL(page)) {
    await page.locator('[data-load]').click();
    await expect(page.locator('ap-structure')).toHaveAttribute('data-loaded', '', GL);
  }
  const { violations } = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`)).toEqual([]);
});

test('the apoptosis card shows the compact pathway, one step at a time, with a link to the full page', async ({ page }) => {
  await page.goto('en/e/apoptosis/');
  const block = page.locator('ap-pathway[data-compact]');
  await expect(block.locator('[data-step-item]:visible')).toHaveCount(1);
  await block.locator('[data-step-next]').click();
  await expect(block.locator('[data-step-item]:visible [data-step-title]')).toHaveText('BH3-only proteins switch on');
  await expect(block.getByRole('link', { name: /Open the full pathway/ })).toHaveAttribute('href', /\/en\/pathways\/intrinsic-apoptosis\/$/);
});
