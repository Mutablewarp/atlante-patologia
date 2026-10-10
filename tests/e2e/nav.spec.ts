/**
 * Navigation by width (NAVIGATION_SPEC §1, §7): bottom tab bar < 600px,
 * rail 600–1023px, sidebar ≥ 1024px; aria-current on the active tab; target
 * sizes (nav ≥ 44px, everything else ≥ 24px, WCAG 2.5.8); no horizontal scroll.
 */
import { expect, test } from '@playwright/test';
import { TEMPLATES } from './pages.ts';

const width = () => test.info().project.metadata.width as number;

test('the primary navigation takes the right form for the width @smoke', async ({ page }) => {
  await page.goto('it/atlas/');
  const nav = page.locator('nav.primary-nav');
  const box = (await nav.boundingBox())!;
  const vp = page.viewportSize()!;
  const brand = page.locator('.primary-nav .nav-brand');
  if (width() < 600) {
    expect(await nav.evaluate((n) => getComputedStyle(n).position)).toBe('fixed');
    expect(Math.round(box.y + box.height)).toBe(vp.height);
    expect(Math.round(box.width)).toBe(vp.width);
  } else {
    expect(box.x).toBe(0);
    expect(box.height).toBeGreaterThan(vp.height * 0.9);
    expect(box.width).toBeLessThan(vp.width / 2);
    if (width() < 1024) await expect(brand).toBeHidden();
    else {
      await expect(brand).toBeVisible();
      await expect(page.locator('[data-sidebar-toggle]')).toBeVisible();
      await expect(page.locator('.primary-nav .nav-label').first()).toBeVisible();
    }
  }
});

test('the active tab is marked with aria-current="page" @smoke', async ({ page }) => {
  for (const [path, tab] of [
    ['it/', 'home'],
    ['en/atlas/system/', 'atlas'],
    ['it/study/', 'study'],
    ['en/search/', 'search'],
    ['it/me/', 'me'],
  ] as const) {
    await page.goto(path);
    const current = page.locator('.primary-nav [aria-current="page"]');
    await expect(current, path).toHaveCount(1);
    await expect(current, path).toHaveAttribute('data-tab', tab);
  }
});

test('navigation targets are ≥ 44px and other targets ≥ 24px', async ({ page }) => {
  for (const path of Object.values(TEMPLATES)) {
    await page.goto(path);
    const small = await page.evaluate(() => {
      const out: string[] = [];
      const sel = 'a[href], button, input:not([type="hidden"]), select, textarea, summary, [role="button"], [tabindex="0"]';
      for (const el of document.querySelectorAll<HTMLElement>(sel)) {
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        if (r.width <= 1 || r.height <= 1 || cs.visibility === 'hidden') continue; // not rendered / visually hidden
        if (el.classList.contains('skip-link')) continue; // off screen until focused
        const inNav = !!el.closest('.primary-nav .nav-list');
        const min = inNav ? 44 : 24;
        // WCAG 2.5.8 exception: links inside a sentence are sized by the line height.
        if (!inNav && cs.display === 'inline') continue;
        if (r.width < min - 0.5 || r.height < min - 0.5)
          out.push(`<${el.tagName.toLowerCase()}> "${(el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 30)}" ${Math.round(r.width)}×${Math.round(r.height)} < ${min}`);
      }
      return out;
    });
    expect(small, path).toEqual([]);
  }
});

test('no page scrolls horizontally @smoke', async ({ page }) => {
  for (const path of Object.values(TEMPLATES)) {
    await page.goto(path);
    const [scroll, client] = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
    expect(scroll, path).toBeLessThanOrEqual(client);
  }
});
