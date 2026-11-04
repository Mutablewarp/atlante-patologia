/**
 * Image viewer (components/horizontal/ImageViewer.astro, scripts/image-viewer.ts):
 * pan buttons (WCAG 2.5.7), keyboard and double-click zoom, the sharper srcset
 * candidate on zoom, full screen on a phone (Escape and Back close it; axe),
 * labels that never cover each other, the original SVG diagrams, the credit
 * line in the page language and the stain/magnification switch. The switch
 * runs on the draft fixture group (fixture-grid + fixture-grid-b), so it needs
 * a PREVIEW_DRAFTS=1 build:
 *   npx playwright test -c tests/e2e/study.config.ts tests/e2e/viewer.spec.ts
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { sep } from 'node:path';
import { expect, test, type Locator, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.use({ reducedMotion: 'reduce' });

const ENTITY = 'it/e/apoptosis/';
/** The figure with the widest srcset on the entity page (1024 px original: 480w, 800w, 1024w). */
const FIG = '#fig-apoptosis-micro-2';
/** Every built page with image labels, read from dist/, so newly annotated images are covered too. */
const LABELLED = existsSync('dist')
  ? readdirSync('dist', { recursive: true, encoding: 'utf8' })
      .filter((f) => f.endsWith('index.html') && readFileSync(`dist/${f}`, 'utf8').includes('class="viewer-label"'))
      .map((f) => f.split(sep).join('/').replace(/index\.html$/, ''))
      .sort()
  : [];

/** Current zoom and offset of the visible canvas (engines serialize the inline transform differently). */
async function view(fig: Locator) {
  return fig.locator('.viewer-panel:not([hidden]) .viewer-canvas').evaluate((el) => {
    const m = new DOMMatrix(getComputedStyle(el).transform);
    const r = (n: number) => Math.round(n * 1000) / 1000 + 0; // + 0 turns -0 into 0
    return { x: r(m.e), y: r(m.f), s: r(m.a) };
  });
}

async function openViewer(page: Page) {
  await page.goto(ENTITY);
  // A late font swap re-flows the toolbar and can move a button between Playwright's hit test and the click.
  await page.evaluate(() => document.fonts.ready);
  return page.locator(FIG);
}

test('@smoke pan buttons stay disabled until zoomed, then move the image; focus stays when they disable', async ({ page }) => {
  const fig = await openViewer(page);
  const right = fig.getByRole('button', { name: 'Sposta a destra' });
  const down = fig.getByRole('button', { name: 'Sposta in basso' });
  // WebKit can resolve a click before the page has handled it, so every reading polls.
  const at = (k: 'x' | 'y' | 's') => expect.poll(async () => (await view(fig))[k]);
  // aria-disabled, not disabled: a focused pan button keeps focus when the zoom returns to 1× (WCAG 2.4.3).
  await expect(right).toHaveAttribute('aria-disabled', 'true');
  await fig.getByRole('button', { name: 'Ingrandisci' }).click();
  await fig.getByRole('button', { name: 'Ingrandisci' }).click();
  await at('s').toBeCloseTo(2.25);
  await expect(right).toHaveAttribute('aria-disabled', 'false');
  const before = await view(fig);
  await right.click();
  await at('x').toBeLessThan(before.x);
  await down.click();
  await at('y').toBeLessThan(before.y);
  const after = await view(fig);
  await fig.getByRole('button', { name: 'Sposta a sinistra' }).click();
  await at('x').toBeGreaterThan(after.x);
  await fig.getByRole('button', { name: 'Sposta in alto' }).click();
  await at('y').toBeGreaterThan(after.y);
  await right.focus();
  // Zoom back to 1× without moving focus (as Ctrl+wheel or a pinch would).
  await fig.locator('[data-zoom="reset"]').evaluate((b: HTMLButtonElement) => b.click());
  await expect.poll(() => view(fig)).toEqual({ x: 0, y: 0, s: 1 });
  await expect(right).toHaveAttribute('aria-disabled', 'true');
  await expect(right).toBeFocused();
  // Playwright refuses to click an aria-disabled button: activate it from the keyboard; it does nothing at 1×.
  await page.keyboard.press('Enter');
  await expect.poll(() => view(fig)).toEqual({ x: 0, y: 0, s: 1 });
});

test('@smoke keyboard zoom: + zooms, arrows pan, 0 resets', async ({ page }) => {
  const fig = await openViewer(page);
  const at = (k: 'x' | 's') => expect.poll(async () => (await view(fig))[k]);
  await fig.locator('.viewer-stage').focus();
  await page.keyboard.press('+');
  await at('s').toBeCloseTo(1.5);
  const before = await view(fig);
  await page.keyboard.press('ArrowRight');
  await at('x').toBeLessThan(before.x);
  await page.keyboard.press('-');
  await at('s').toBe(1);
  await page.keyboard.press('=');
  await at('s').toBeCloseTo(1.5);
  await page.keyboard.press('0');
  await expect.poll(() => view(fig)).toEqual({ x: 0, y: 0, s: 1 });
});

test('double click zooms in at the pointer; past 1.5× the largest srcset candidate loads', async ({ page }) => {
  const fig = await openViewer(page);
  const img = fig.locator('img');
  const largest = await img.evaluate((i: HTMLImageElement) => i.srcset.split(',').at(-1)!.trim().split(' ')[0]!);
  await fig.locator('.viewer-stage').dblclick();
  await expect.poll(async () => (await view(fig)).s).toBe(2);
  await expect(img).toHaveAttribute('sizes', /^\d+px$/);
  await expect.poll(() => img.evaluate((i: HTMLImageElement) => new URL(i.currentSrc).pathname)).toBe(largest);
  // The box keeps its size: width/height stay, so nothing below moves.
  await expect(img).toHaveAttribute('width', '1024');
});

test('@smoke full screen on a phone: a 100dvh dialog that Escape and Back close', async ({ page, isMobile, browserName }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  const fig = await openViewer(page);
  // Inline the stage is edge to edge.
  const inline = (await fig.locator('.viewer-stage').boundingBox())!;
  expect(inline.x).toBeCloseTo(0, 0);
  expect(inline.width).toBeCloseTo(375, 0);
  const full = fig.getByRole('button', { name: 'Schermo intero' });
  await full.click();
  // Named briefly: the image's long alt is read once, on the image itself.
  const dialog = page.getByRole('dialog', { name: 'Immagine a schermo intero' });
  await expect(dialog).toBeVisible();
  const box = (await dialog.boundingBox())!;
  expect(box.x).toBeCloseTo(0, 0);
  expect(box.width).toBeCloseTo(375, 0);
  expect(box.height).toBeCloseTo(667, 0);
  await expect(dialog.locator('.viewer-stage')).toBeVisible();
  const stage = (await dialog.locator('.viewer-stage').boundingBox())!;
  expect(stage.x + stage.width).toBeLessThanOrEqual(375);
  // The status line moves into the modal dialog with the controls, so its announcements are not inert (WCAG 4.1.3).
  await dialog.getByRole('button', { name: 'Mostra l’etichetta successiva' }).click();
  await expect(dialog.locator('[role="status"][data-viewer-status]')).toHaveText(/^1\/\d+: \S/);
  // Inside the dialog the plain wheel zooms (no page to scroll behind it); mobile WebKit has no wheel.
  if (!(isMobile && browserName === 'webkit')) {
    await dialog.locator('.viewer-stage').hover();
    await page.mouse.wheel(0, -200);
    await expect.poll(async () => (await view(fig)).s).toBeGreaterThan(1);
  }
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(full).toBeFocused();
  await expect(fig.locator('.viewer-body')).toBeVisible();

  await full.click();
  await expect(dialog).toBeVisible();
  const url = page.url();
  await page.goBack();
  await expect(dialog).toBeHidden();
  expect(page.url()).toBe(url);

  await full.click();
  await dialog.getByRole('button', { name: 'Chiudi schermo intero' }).click();
  await expect(dialog).toBeHidden();
  expect(page.url()).toBe(url);
});

for (const scheme of ['light', 'dark'] as const)
  test(`the full-screen viewer has no axe violations (${scheme})`, async ({ page }) => {
    test.skip(![375, 1280].includes(test.info().project.metadata.width as number), 'runs at 375 and 1280 px');
    await page.emulateMedia({ colorScheme: scheme });
    const fig = await openViewer(page);
    await fig.getByRole('button', { name: 'Schermo intero' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    const axe = await new AxeBuilder({ page }).include('.viewer-dialog').withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
    expect(axe.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
  });

test('labels stay inside the image and never cover each other on any labelled page (numbers stand in, moved apart if needed)', async ({ page }) => {
  test.skip(![375, 1280].includes(test.info().project.metadata.width as number), 'every labelled page, at 375 and 1280 px');
  test.setTimeout(120_000);
  expect(LABELLED.length).toBeGreaterThan(10);
  for (const path of LABELLED) {
    await page.goto(path);
    await page.evaluate(() => document.fonts.ready);
    const problems = () =>
      page.evaluate(() =>
        [...document.querySelectorAll('.viewer-panel:not([hidden]) .viewer-stage')].flatMap((stage) => {
          const s = stage.getBoundingClientRect();
          const boxes = [...stage.querySelectorAll<HTMLElement>('.viewer-label')]
            .filter((l) => l.checkVisibility())
            .map((l) => [l.textContent!.trim(), l.getBoundingClientRect()] as const);
          const out = boxes
            .filter(([, b]) => b.left < s.left - 0.5 || b.right > s.right + 0.5 || b.top < s.top - 0.5 || b.bottom > s.bottom + 0.5)
            .map(([t]) => `cut off: ${t}`);
          boxes.forEach(([t, a], i) =>
            boxes.slice(i + 1).forEach(([u, b]) => {
              if (Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1)
                out.push(`overlap: ${t} / ${u}`);
            }),
          );
          return out;
        }),
      );
    await expect.poll(problems, { message: path }).toEqual([]);
  }
});

test('the original SVG diagrams render on the card, not the "not available yet" placeholder', async ({ page }) => {
  for (const [path, missing] of [
    ['it/e/apoptosis/', 'Immagine non ancora disponibile.'],
    ['en/e/apoptosis/', 'Image not available yet.'],
  ] as const) {
    await page.goto(path);
    await expect(page.getByText(missing)).toHaveCount(0);
    const diagrams = page.locator('.viewer-canvas img[src$=".svg"]');
    await expect(diagrams).toHaveCount(2);
    for (const img of await diagrams.all()) {
      await img.scrollIntoViewIfNeeded();
      await expect.poll(() => img.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth), { message: path }).toBeGreaterThan(0);
    }
  }
});

test('the credit line states our changes to the image in the page language', async ({ page }) => {
  for (const [path, text] of [
    ['it/e/apoptosis/', 'Ricodifica in JPEG (qualità 85)'],
    ['en/e/apoptosis/', 'Re-encoded as JPEG (quality 85)'],
  ] as const) {
    await page.goto(path);
    await expect(page.locator(`${FIG} .credit`)).toContainText(text);
  }
});

test.describe('stain and magnification switch (draft fixtures)', () => {
  test.beforeEach(async ({ request }) => {
    test.skip(!(await request.get('it/e/fixture-demo-b/')).ok(), 'needs a PREVIEW_DRAFTS=1 build with the draft fixtures');
  });

  test('radios switch image, labels and caption; zoom stays, position resets; scale bar only with mpp', async ({ page }) => {
    await page.goto('it/e/fixture-demo-b/');
    await page.evaluate(() => document.fonts.ready);
    const fig = page.locator('#fig-fixture-grid');
    const group = fig.getByRole('group', { name: 'Colorazione, sezione e ingrandimento' });
    const radios = group.getByRole('radio');
    await expect(radios).toHaveCount(2);
    await expect(radios.nth(0)).toBeChecked();
    await expect(radios.nth(0)).toHaveAccessibleName('EE · in paraffina · piccolo ingrandimento');
    await expect(radios.nth(1)).toHaveAccessibleName('PAS · in paraffina · forte ingrandimento · 40x');
    await expect(fig.locator('[data-scale]:visible')).toHaveCount(0);
    await expect(fig.getByText('Testo segnaposto: prima il quadro')).toBeVisible();

    await fig.getByRole('button', { name: 'Ingrandisci' }).click();
    await fig.getByRole('button', { name: 'Sposta a destra' }).click();
    await expect.poll(async () => (await view(fig)).x).toBeLessThan(0);

    await radios.nth(0).focus();
    await page.keyboard.press('ArrowRight');
    await expect(radios.nth(1)).toBeChecked();
    await expect.poll(() => view(fig)).toEqual({ x: 0, y: 0, s: 1.5 });
    // The stage is a short "zoomable image" group; the alt is read once, on the image itself.
    await expect(fig.getByRole('group', { name: 'Immagine ingrandibile' })).toBeVisible();
    await expect(fig.getByRole('img', { name: /Griglia di quadrati in altri colori/ })).toBeVisible();
    await expect(fig.getByRole('img', { name: /con tre cerchi/ })).toBeHidden();
    await expect(fig.getByRole('list', { name: 'Etichette dell’immagine' })).toHaveText('Etichetta B');
    await expect(fig.getByText('Immagine di prova B')).toBeVisible();
    await expect(fig.getByText('Immagine di prova: griglia')).toBeHidden();
    await expect(fig.getByText('Obiettivo: 40x')).toBeVisible();
    await expect(fig.locator('[data-scale]')).toBeVisible();
    await expect(fig.locator('[data-scale]')).toHaveText(/^\d+ µm$/);
    await expect(page.getByRole('status').filter({ hasText: 'PAS' })).toHaveCount(1);

    // Labels are per image: the reveal walks image B's single label.
    await fig.getByRole('button', { name: 'Mostra l’etichetta successiva' }).click();
    await expect(fig.locator('.viewer-panel:not([hidden]) .viewer-label:visible')).toHaveText(['Etichetta B']);

    const axe = await new AxeBuilder({ page }).include('#fig-fixture-grid').withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
    expect(axe.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);

    // Full screen: a short dialog name; the image shown now is named once, by its own alt; a switch made inside
    // the modal is announced from inside it (outside, the status line would be inert: WCAG 4.1.3).
    await fig.getByRole('button', { name: 'Schermo intero' }).click();
    const dialog = page.getByRole('dialog', { name: 'Immagine a schermo intero' });
    await expect(dialog.getByRole('img', { name: /Griglia di quadrati in altri colori/ })).toBeVisible();
    await dialog.getByRole('radio', { checked: true }).focus();
    await page.keyboard.press('ArrowLeft');
    await expect(dialog.getByRole('radio').nth(0)).toBeChecked();
    await expect(dialog.getByRole('img', { name: /con tre cerchi/ })).toBeVisible();
    await expect(dialog.getByRole('img', { name: /Griglia di quadrati in altri colori/ })).toBeHidden();
    await expect(dialog.locator('[role="status"][data-viewer-status]')).toHaveText('EE · in paraffina · piccolo ingrandimento');
  });
});
