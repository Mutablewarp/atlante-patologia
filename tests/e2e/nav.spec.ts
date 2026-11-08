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

test.describe('touch screens', () => {
  test.use({ hasTouch: true, reducedMotion: 'reduce' }); // (pointer: coarse) in Chromium and WebKit

  test('from 600 px every control and list entry is at least 44 px tall (SC 2.5.5); phones keep their size', async ({ page }) => {
    test.skip(width() !== 768, 'one run per engine: the test sets its own iPad and phone viewports');
    await page.addInitScript(() => localStorage.setItem('ap-disclaimer', '1'));
    const SEL = '.chip, .btn-small, .segmented button, .section-toc a, .breadcrumb a, .pager a, .lens-terms a, .matrix-thumb, .module-tree a, .module-tree summary';
    const heights = () =>
      page.evaluate((sel) => {
        const out: Record<string, number> = {};
        for (const el of document.querySelectorAll<HTMLElement>(sel)) {
          if (!el.getClientRects().length || el.closest('dialog:not([open])')) continue; // not rendered
          const key = `${el.className || el.tagName.toLowerCase()} "${el.textContent!.trim().slice(0, 24)}"`;
          out[key] = Math.min(out[key] ?? 99, el.getBoundingClientRect().height);
        }
        return out;
      }, SEL);
    for (const viewport of [
      { width: 820, height: 1180 }, // iPad portrait: chip strip, chapter dialog
      { width: 1180, height: 820 }, // iPad landscape: side list, sidebar index
    ]) {
      await page.setViewportSize(viewport);
      for (const path of ['it/e/coagulative-necrosis/', 'it/atlas/', 'en/pattern/p01-necrosis/']) {
        await page.goto(path);
        if (path.includes('/e/')) {
          await page.getByRole('button', { name: /^Lenti/ }).click(); // the lens chips
          await page.getByRole('button', { name: 'Strumenti' }).click(); // the small buttons of the tools
          if (viewport.width < 1024) await page.getByRole('button', { name: 'Capitolo' }).click(); // the chapter index
        }
        const small = Object.entries(await heights()).filter(([, h]) => h < 43.5);
        expect(small, `${path} at ${viewport.width} px`).toEqual([]);
        if (viewport.width < 1024 && path.includes('/e/')) await page.keyboard.press('Escape');
      }
      // The first sentence of the card stays on the first screen (it reached 809 of 820 px before the touch sizes).
      await page.goto('it/e/coagulative-necrosis/');
      const sentence = await page.evaluate(() => {
        const walker = document.createTreeWalker(document.querySelector('#definition-body > p')!, NodeFilter.SHOW_TEXT);
        for (let n = walker.nextNode(); n; n = walker.nextNode()) {
          const end = n.textContent!.search(/[.!?](\s|$)/);
          if (end < 0) continue;
          const range = document.createRange();
          range.setStart(n, end);
          range.setEnd(n, end + 1);
          return range.getBoundingClientRect().bottom;
        }
        return Infinity;
      });
      expect(sentence, `first sentence at ${viewport.width} px`).toBeLessThanOrEqual(viewport.height);
    }
    // The taller chip strip of tablets: anchors and focus still stop below it (scroll-padding reads --chips-h).
    await page.setViewportSize({ width: 820, height: 1180 });
    await page.goto('it/e/coagulative-necrosis/');
    const [strip, token] = await page.evaluate(() => [
      document.querySelector('.section-toc')!.getBoundingClientRect().height,
      parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--chips-h')) * parseFloat(getComputedStyle(document.documentElement).fontSize),
    ]);
    expect(Math.abs(strip - token)).toBeLessThan(2);
    // Phones are left as they are.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('it/e/coagulative-necrosis/');
    expect((await page.locator('.section-toc a').first().boundingBox())!.height).toBeCloseTo(36, 0);
    expect((await page.locator('.segmented button').first().boundingBox())!.height).toBeCloseTo(32, 0);
  });

});

test('no page scrolls horizontally @smoke', async ({ page }) => {
  for (const path of Object.values(TEMPLATES)) {
    await page.goto(path);
    const [scroll, client] = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
    expect(scroll, path).toBeLessThanOrEqual(client);
  }
});

// macOS WebKit only moves focus to links with Option+Tab (system default).
const tabKey = (browserName: string) => (browserName === 'webkit' && process.platform === 'darwin' ? 'Alt+Tab' : 'Tab');

test('the chapter index opens from the top bar where the sidebar does not show it, on the current card', async ({ page, browserName }) => {
  await page.goto('it/e/coagulative-necrosis/');
  const open = page.getByRole('button', { name: 'Capitolo' });
  if (width() < 600) return await expect(open).toBeHidden(); // phones keep their layout
  const sidebarTree = page.locator('.primary-nav .module-tree');
  if (width() >= 1024) {
    await expect(sidebarTree).toBeVisible();
    await expect(open).toBeHidden();
    await page.locator('[data-sidebar-toggle]').click(); // collapsed, the sidebar has no index: the button takes over
    await expect(sidebarTree).toBeHidden();
  }
  await open.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Indice dei capitoli' });
  await expect(dialog).toBeVisible();
  const current = dialog.getByRole('link', { name: /^Necrosi coagulativa/ });
  await expect(current).toHaveAttribute('aria-current', 'location');
  await expect(current).toContainText('sei qui');
  await expect(current).toBeFocused();
  await expect(current).toBeInViewport();
  // Italian names, Italian order: the next entry is the next card of the chapter.
  await page.keyboard.press(tabKey(browserName));
  await expect(dialog.getByRole('link', { name: 'Necrosi colliquativa' })).toBeFocused();
  // Modal: Tab never reaches the page behind (the platform keeps focus inside).
  for (let i = 0; i < 32; i++) {
    await page.keyboard.press(tabKey(browserName));
    const inside = await page.evaluate(() => {
      const el = document.activeElement;
      return !el || el === document.body || !!el.closest('dialog[open]');
    });
    expect(inside, `Tab ${i + 1}`).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(open).toBeFocused();
});

test('from 600 px the previous and next card sit beside the breadcrumb, in the order of the context', async ({ page }) => {
  await page.goto('it/e/coagulative-necrosis/');
  const pager = page.locator('.crumb-row .pager');
  if (width() < 600) return await expect(pager).toBeHidden(); // phones keep their layout
  const prev = pager.getByRole('link', { name: 'Scheda precedente: Necrosi caseosa' });
  const next = pager.getByRole('link', { name: 'Scheda successiva: Necrosi colliquativa' });
  await expect(prev).toHaveAttribute('href', /\/it\/e\/caseous-necrosis\/$/);
  await expect(next).toHaveAttribute('href', /\/it\/e\/liquefactive-necrosis\/$/);
  // The same neighbours as the links at the end of the card.
  await expect(page.locator('[data-lens-nav] a[rel="next"]')).toHaveAttribute('href', (await next.getAttribute('href'))!);
  // On a computer the pair shares the breadcrumb's row: the card text does not move down.
  if (width() >= 1024) {
    const [crumb, pair] = [(await page.locator('.crumb-row .breadcrumb').boundingBox())!, (await pager.boundingBox())!];
    expect(Math.abs(crumb.y - pair.y)).toBeLessThan(4);
  }
  // Reached through a lens, the pair follows that lens's order.
  await page.goto('it/e/coagulative-necrosis/?via=system:heart');
  await expect(pager.getByRole('link', { name: 'Scheda successiva: Steatosi (degenerazione grassa)' })).toHaveAttribute('href', /\/fatty-change\/\?via=system:heart$/);
});

test.describe('smooth scrolling', () => {
  test.use({ reducedMotion: 'no-preference' });

  test('a tapped section entry stays the only one marked while the page scrolls to its section', async ({ page }) => {
    await page.goto('it/e/apoptosis/');
    await page.locator('.section-toc a[href="#prognosis"]').click();
    // Sampled every frame while the page passes the sections in between, and after it stops: never another entry.
    const marks = await page.evaluate(
      () =>
        new Promise<string[]>((resolve) => {
          const seen = new Set<string>();
          const t0 = performance.now();
          const tick = () => {
            seen.add(document.querySelector('.section-toc a[aria-current]')?.getAttribute('href') ?? 'none');
            if (performance.now() - t0 < 1500) requestAnimationFrame(tick);
            else resolve([...seen]);
          };
          tick();
        }),
    );
    expect(marks).toEqual(['#prognosis']);
    expect(await page.evaluate(() => scrollY)).toBeGreaterThan(1000); // it did scroll
  });
});

test('the sidebar chapter index opens on the current card and fades where it hides cards', async ({ page }) => {
  test.skip(width() < 1024, 'the sidebar shows its index from 1024 px');
  await page.goto('it/e/metaplasia/'); // 17th of 26: below the first screenful of the index
  const tree = page.locator('.primary-nav .module-tree');
  // The current card and the one after it are inside the index's box, which scrolled; the page did not.
  const shown = () =>
    tree.evaluate((t) => {
      const box = t.getBoundingClientRect();
      const inside = (a: Element | null | undefined) => !!a && a.getBoundingClientRect().top >= box.top && a.getBoundingClientRect().bottom <= box.bottom;
      const cur = t.querySelector('a[aria-current]');
      return t.scrollTop > 0 && inside(cur) && inside(cur?.closest('li')?.nextElementSibling?.querySelector('a'));
    });
  await expect.poll(shown).toBe(true);
  expect(await page.evaluate(() => scrollY)).toBe(0);
  await expect(tree).toHaveAttribute('data-fade', /start/);
  expect(await tree.evaluate((t) => getComputedStyle(t).maskImage)).toContain('gradient');
  // Scrolled back to the top, only the bottom edge fades; collapsed and expanded, it opens on the card again.
  await tree.evaluate((t) => (t.scrollTop = 0));
  await expect(tree).toHaveAttribute('data-fade', 'end');
  await page.locator('[data-sidebar-toggle]').click();
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))); // a person is slower than a frame
  await page.locator('[data-sidebar-toggle]').click();
  await expect.poll(shown).toBe(true);
});
