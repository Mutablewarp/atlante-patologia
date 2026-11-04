/**
 * 3D pathways (O9): the 2D stepper, the "Load the 3D view" button, step sync
 * of the 3D highlight, our own controls, no third-party requests, axe and the
 * model's contrast with the viewer open (light and dark), readable future
 * steps and 44 px touch targets. Without WebGL the poster, description and
 * steps must stay.
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';
import sharp from 'sharp';

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
  // Three WebGL waits of up to 20 s each: the default 30 s test timeout is too short under parallel load.
  test.setTimeout(90_000);
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
  const load = viewer.locator('[data-load]');
  // Activated from the keyboard, the button keeps the focus while the view loads (WCAG 2.4.3), read synchronously.
  const loading = await load.evaluate((b: HTMLButtonElement) => {
    b.focus();
    b.click();
    return { focused: document.activeElement === b, busy: b.getAttribute('aria-disabled'), text: b.textContent };
  });
  if (!webgl) {
    await expect(viewer.locator('[data-fallback]')).toBeVisible();
    await expect(viewer.locator('[data-fallback]')).toBeFocused();
    await expect(viewer.locator('img[data-poster]:visible')).toHaveCount(1);
    return;
  }
  expect(loading).toEqual({ focused: true, busy: 'true', text: 'Caricamento della vista 3D…' });
  await expect(viewer).toHaveAttribute('data-loaded', '', GL);
  await expect(viewer.locator('[data-stage]')).toBeFocused();
  await expect(viewer.locator('[data-tools]')).toBeVisible();
  await expect(viewer.locator('canvas')).toHaveCount(1);
  // Step 1 has no structure: the first structured step (3, BCL-2 + venetoclax) is shown.
  await expect(viewer).toHaveAttribute('data-shown', '6o0k:2', GL);
  const venetoclax = Number(await viewer.getAttribute('data-highlight-atoms'));
  expect(venetoclax).toBeGreaterThan(0);
  // The stage (a canvas exposes nothing) is described by the visible text about the structure shown.
  const stage = viewer.locator('[data-stage]');
  await expect(stage).toHaveAccessibleDescription(/PDB 6O0K/);

  // The 3D toolbar's own "next" drives the shared stepper: step 2 keeps 6O0K, step 3 shows it, step 4 is BAX.
  const next = viewer.locator('[data-act="next"]');
  await next.click();
  await next.click();
  await expect(page.locator('[data-step-item]').nth(2)).toHaveAttribute('aria-current', 'step');
  await next.click();
  await expect(viewer).toHaveAttribute('data-shown', '1f16:3', GL);
  await expect(stage).toHaveAccessibleDescription(/PDB 1F16/);
  const helix = Number(await viewer.getAttribute('data-highlight-atoms'));
  expect(helix).toBeGreaterThan(0);
  expect(helix).not.toBe(venetoclax);
  // The diagram and the 3D view stay in step.
  await expect(page.locator('[data-step-box="3"]')).toHaveAttribute('data-state', 'current');

  // Our controls and keys work without throwing.
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  // Single-pointer alternatives to dragging about both axes (WCAG 2.5.7).
  for (const act of ['left', 'right', 'up', 'down', 'in', 'out', 'reset']) await viewer.locator(`[data-act="${act}"]`).click();
  await viewer.locator('[data-act="labels"]').click();
  await expect(viewer.locator('[data-act="labels"]')).toHaveAttribute('aria-pressed', 'false');
  await viewer.locator('[data-stage]').focus();
  for (const key of ['ArrowLeft', 'ArrowUp', '+', '-', '0']) await page.keyboard.press(key);
  expect(errors).toEqual([]);

  expect(requests.filter((u) => new URL(u).origin !== origin && !/^(data|blob):/.test(u))).toEqual([]);
  expect(requests.some((u) => u.includes('/structures/1f16.bcif.gz'))).toBe(true);
});

/** Relative luminance of an sRGB colour (WCAG). */
const lum = ([r, g, b]: number[]) => {
  const f = (v: number) => ((v /= 255) <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r!) + 0.7152 * f(g!) + 0.0722 * f(b!);
};

/** Contrast against the stage of the median grey and the median orange pixel of the rendered model. */
async function modelContrast(canvas: Locator) {
  const { data, info } = await sharp(await canvas.screenshot()).raw().toBuffer({ resolveWithObject: true });
  const at = (8 * info.width + 8) * info.channels; // just inside the rounded corner: always stage
  const stage = lum([data[at]!, data[at + 1]!, data[at + 2]!]);
  const grey: number[] = [];
  const orange: number[] = [];
  for (let i = 0; i < data.length; i += info.channels) {
    const [r, g, b] = [data[i]!, data[i + 1]!, data[i + 2]!];
    const l = lum([r, g, b]);
    if (Math.abs(l - stage) < 0.05) continue; // the stage and its anti-aliased edges
    if (r - b > 80) orange.push(l);
    else if (Math.abs(r - g) < 12 && Math.abs(g - b) < 12) grey.push(l);
  }
  const ratio = (a: number[]) => (stage + 0.05) / (a.sort((x, y) => x - y)[a.length >> 1]! + 0.05);
  return { grey: ratio(grey), orange: ratio(orange) };
}

for (const scheme of ['light', 'dark'] as const)
  test(`with the 3D view open: no axe violations, and the model keeps 3:1 against its stage (${scheme})`, async ({ page }) => {
    test.setTimeout(60_000);
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto(PAGE);
    const webgl = await hasWebGL(page);
    if (webgl) {
      await page.locator('[data-load]').click();
      await expect(page.locator('ap-structure')).toHaveAttribute('data-loaded', '', GL);
    }
    const { violations } = await new AxeBuilder({ page }).withTags(WCAG).analyze();
    expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`)).toEqual([]);
    if (!webgl) return;
    // WCAG 1.4.11 in both themes (the canvas keeps its own light stage); the 3D label would count as grey.
    await page.locator('[data-act="labels"]').click();
    const c = await modelContrast(page.locator('[data-canvas]'));
    expect(c.grey).toBeGreaterThanOrEqual(3);
    expect(c.orange).toBeGreaterThanOrEqual(3);
  });

test('without WebGL the 3D button gives way to a focused explanation; poster and steps stay', async ({ page }) => {
  await page.addInitScript(() => {
    const get = HTMLCanvasElement.prototype.getContext;
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
      value(this: HTMLCanvasElement, type: string, ...args: unknown[]) {
        return type.startsWith('webgl') ? null : Reflect.apply(get, this, [type, ...args]);
      },
    });
  });
  await page.goto(PAGE);
  const viewer = page.locator('ap-structure');
  await viewer.locator('[data-load]').focus();
  await page.keyboard.press('Enter');
  await expect(viewer.locator('[data-fallback]')).toBeVisible();
  await expect(viewer.locator('[data-fallback]')).toBeFocused();
  await expect(viewer.locator('[data-load]')).toBeHidden();
  await expect(viewer.locator('[data-status]')).toHaveText(/non è disponibile su questo dispositivo/);
  await expect(viewer.locator('img[data-poster]:visible')).toHaveCount(1);
  await expect(page.locator('[data-step-item]')).toHaveCount(10);
});

test('on touch screens the stepper and the 3D tools have 44 px targets', async ({ page }) => {
  await page.goto(PAGE);
  test.skip(!(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)), 'needs a coarse pointer (phone projects)');
  for (const b of await page.locator('.pw-controls .btn-small').all()) {
    const box = (await b.boundingBox())!;
    expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(44);
  }
  // The 3D toolbar is hidden until loaded: its computed minimum size is enough.
  const mins = await page.locator('.structure-tools .btn-small').evaluateAll((bs) => bs.map((b) => parseFloat(getComputedStyle(b).minHeight)));
  expect(mins.length).toBeGreaterThan(5);
  for (const m of mins) expect(m).toBeGreaterThanOrEqual(44);
});

test('the apoptosis card shows the compact pathway, one step at a time, with a link to the full page', async ({ page }) => {
  await page.goto('en/e/apoptosis/');
  const block = page.locator('ap-pathway[data-compact]');
  await expect(block.locator('[data-step-item]:visible')).toHaveCount(1);
  await block.locator('[data-step-next]').click();
  await expect(block.locator('[data-step-item]:visible [data-step-title]')).toHaveText('BH3-only proteins switch on');
  await expect(block.getByRole('link', { name: /Open the full pathway/ })).toHaveAttribute('href', /\/en\/pathways\/intrinsic-apoptosis\/$/);
});

/** Effective contrast of each future step label: fill composited with every ancestor's opacity over the page. */
const futureLabelContrast = (page: Page, scope: string) =>
  page.locator(scope).evaluate((root) => {
    const rgb = (c: string) => (c.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
    const lum = ([r, g, b]: number[]) => {
      const f = (v: number) => ((v /= 255) <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
      return 0.2126 * f(r!) + 0.7152 * f(g!) + 0.0722 * f(b!);
    };
    const pageBg = rgb(getComputedStyle(document.body).backgroundColor);
    return [...root.querySelectorAll<SVGTextElement>('[data-state="future"] text')].map((t) => {
      let alpha = 1;
      for (let el: Element | null = t; el && el !== document.body; el = el.parentElement) alpha *= Number(getComputedStyle(el).opacity);
      const fill = rgb(getComputedStyle(t).fill).map((c, i) => alpha * c + (1 - alpha) * pageBg[i]!);
      const [hi, lo] = [lum(fill), lum(pageBg)].sort((a, b) => b - a);
      return (hi! + 0.05) / (lo! + 0.05);
    });
  });

for (const scheme of ['light', 'dark'] as const)
  test(`future steps in the 2D diagram stay readable (>= 4.5:1, ${scheme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    for (const [path, scope] of [
      [PAGE, '.pw-diagram'],
      ['en/e/apoptosis/', 'ap-pathway[data-compact] .pw-diagram'],
    ] as const) {
      await page.goto(path);
      const ratios = await futureLabelContrast(page, scope);
      expect(ratios.length, path).toBeGreaterThan(5);
      for (const r of ratios) expect(r, path).toBeGreaterThanOrEqual(4.5);
    }
  });
