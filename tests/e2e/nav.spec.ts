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
    const SEL = '.chip, .btn-small, .segmented button, .section-toc a, .breadcrumb a, .pager a, .lens-terms a, .matrix-thumb, .module-tree a, .module-tree summary, .lang-switch a, .topbar-search input';
    // Short labels are as wide as they are tall ("Atlas", "Full", A- and A+), and so are the side list's entries
    const WIDE = '.text-size .btn, .segmented button, .breadcrumb a, .lang-switch a, .section-toc li > a';
    const narrow = () =>
      page.evaluate((sel) => {
        const out: string[] = [];
        for (const el of document.querySelectorAll<HTMLElement>(sel)) {
          const r = el.getBoundingClientRect();
          if (el.checkVisibility() && r.width < 43.5) out.push(`${el.className || el.tagName.toLowerCase()} "${el.textContent!.trim().slice(0, 24)}" ${Math.round(r.width)} px wide`);
        }
        return out;
      }, WIDE);
    // The tap areas of the breadcrumb row (its links and the pager's) never overlap, wrapped or not
    const overlaps = () =>
      page.evaluate(() => {
        const boxes = [...document.querySelectorAll('.crumb-row a')].filter((a) => a.checkVisibility()).map((a) => a.getBoundingClientRect());
        const out: string[] = [];
        boxes.forEach((a, i) =>
          boxes.slice(i + 1).forEach((b) => {
            const [x, y] = [Math.min(a.right, b.right) - Math.max(a.left, b.left), Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)];
            if (x > 0.5 && y > 0.5) out.push(`${Math.round(x)} x ${Math.round(y)} px`);
          }),
        );
        return out;
      });
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
        expect(await narrow(), `${path} at ${viewport.width} px`).toEqual([]);
        expect(await overlaps(), `${path} at ${viewport.width} px: breadcrumb row`).toEqual([]);
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

  test('on an iPad in landscape the side list scrolls inside its box, keeps the current entry in view and the next card on screen', async ({ page }) => {
    test.skip(width() !== 768, 'one run per engine: the test sets its own iPad viewport');
    await page.setViewportSize({ width: 1180, height: 820 });
    await page.goto('it/e/coagulative-necrosis/');
    const list = page.locator('.section-toc ol');
    // Stuck under the top bar, the list ends on the screen and fades at the edge that hides entries; the link to
    // the next card stays under it.
    for (const [id, fade] of [
      ['micro', /end/],
      ['card-nav', /start/],
    ] as const) {
      await page.evaluate((id) => document.getElementById(id)!.scrollIntoView(), id);
      await expect(list).toHaveAttribute('data-fade', fade);
      const state = await page.evaluate(() => {
        const nav = document.querySelector('.section-toc')!;
        const ol = nav.querySelector('ol')!;
        const box = ol.getBoundingClientRect();
        const cur = ol.querySelector('a[aria-current]')?.getBoundingClientRect();
        const next = nav.querySelector('.toc-next a')!.getBoundingClientRect();
        return {
          overflows: ol.scrollHeight > ol.clientHeight,
          sideways: ol.scrollLeft !== 0 || ol.scrollWidth > ol.clientWidth + 1, // a list shifted sideways cut every entry
          bottom: nav.getBoundingClientRect().bottom,
          inside: !!cur && cur.top >= box.top && cur.bottom <= box.bottom,
          next: next.height > 0 && next.top >= box.bottom && next.bottom <= innerHeight,
        };
      });
      expect(state.overflows, id).toBe(true);
      expect(state.sideways, id).toBe(false);
      expect(state.bottom, id).toBeLessThanOrEqual(820);
      expect(state.inside, `${id}: the current entry is in the list's box`).toBe(true);
      expect(state.next, `${id}: "Scheda successiva" under the list, on screen`).toBe(true);
    }
  });
});

test('the palette shortcut shows on its button on iPads in portrait; from 1024 px the search field takes the button’s place', async ({ page }) => {
  await page.goto('it/e/coagulative-necrosis/');
  const button = page.locator('[data-palette-open]');
  const field = page.locator('#global-search');
  if (width() < 600) return await expect(button).toBeHidden(); // phones: search is in the tab bar
  if (width() < 1024) {
    await expect(button.locator('kbd')).toBeVisible();
    await expect(button.locator('kbd')).toHaveText(/^(Ctrl K|⌘ K)$/);
    // The shortcut on the button is part of its name (SC 2.5.3)
    await expect(button).toHaveAccessibleName(/^Ricerca rapida (Ctrl K|⌘ K)$/);
    await expect(field).toBeHidden();
  } else {
    await expect(button).toBeHidden(); // one magnifier, not two
    await expect(field).toBeVisible();
    await expect(page.locator('.topbar-search kbd')).toHaveText(/^(Ctrl K|⌘ K)$/);
  }
  // The shortcut opens the palette at both widths.
  await page.keyboard.press('Control+k');
  await expect(page.getByRole('dialog', { name: 'Ricerca rapida' })).toBeVisible();
});

test('from 600 px the sticky bars are opaque and the home status card has no stripe; phones keep theirs', async ({ page }) => {
  const phone = width() < 600;
  await page.goto('it/e/coagulative-necrosis/');
  for (const sel of ['.topbar', ...(width() < 1024 ? ['.section-toc'] : [])]) {
    const [bg, filter] = await page.locator(sel).evaluate((el) => [getComputedStyle(el).backgroundColor, getComputedStyle(el).backdropFilter]);
    if (phone) expect(filter, sel).toBe('blur(8px)');
    else {
      expect(bg, sel).toMatch(/^rgb\(/); // no alpha: text scrolled under it never shows through
      expect(filter, sel).toBe('none');
    }
  }
  await page.goto('it/');
  expect(await page.locator('.status').evaluate((el) => getComputedStyle(el).borderLeftWidth)).toBe(phone ? '4px' : '1px');
});

test('no page scrolls horizontally @smoke', async ({ page }) => {
  for (const path of Object.values(TEMPLATES)) {
    await page.goto(path);
    const [scroll, client] = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
    expect(scroll, path).toBeLessThanOrEqual(client);
  }
});

test('the study forms never widen a phone page, at every reading size (SC 1.4.10)', async ({ page }) => {
  test.skip(width() >= 600, 'phones: a select as wide as its longest option widened the page by up to 207 px');
  for (const w of [320, width()])
    for (const size of ['m', 'l', 'xl']) {
      await page.setViewportSize({ width: w, height: 740 });
      await page.addInitScript((s) => localStorage.setItem('ap-text', s), size);
      for (const path of ['it/study/quiz/', 'it/study/review/', 'en/me/data/']) {
        await page.goto(path);
        await page.waitForLoadState('networkidle'); // the forms are islands
        const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(over, `${path} at ${w} px, size ${size}`).toBeLessThanOrEqual(0);
      }
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
  // The list scrolls under its title, which stays at the top, and under the close button, which stays on top.
  const pinned = await dialog.evaluate((d) => {
    const tree = d.querySelector<HTMLElement>('.module-tree')!;
    tree.scrollTop = tree.scrollHeight;
    const title = d.querySelector('.module-tree-title')!.getBoundingClientRect();
    const close = d.querySelector('.chapter-close')!.getBoundingClientRect();
    const hit = document.elementFromPoint(close.left + close.width / 2, close.top + close.height / 2);
    return { title: Math.abs(title.top - tree.getBoundingClientRect().top), close: !!hit?.closest('.chapter-close') };
  });
  expect(pinned.title, 'the title at the top of the list').toBeLessThan(1);
  expect(pinned.close, 'the close button above the title').toBe(true);
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

test('from 600 px the section list ends with the related cards and a link to the next card; from 1024 px it sits under the list', async ({ page }) => {
  await page.goto('it/e/coagulative-necrosis/');
  const toc = page.getByRole('navigation', { name: 'In questa pagina' });
  const list = toc.locator('ol');
  const related = list.getByRole('link', { name: 'Collegamenti' });
  const nextEntry = list.getByRole('link', { name: 'Scheda successiva: Necrosi colliquativa' });
  const nextCard = toc.locator('.toc-next a');
  if (width() < 600) {
    // Phones keep their chip strip.
    for (const el of [related, nextEntry, nextCard]) await expect(el).toBeHidden();
    return;
  }
  await expect(page.locator('#related h2')).toHaveText('Collegamenti'); // the entry names its heading
  const shown = await list.locator('a').evaluateAll((as) => as.filter((a) => a.getClientRects().length).map((a) => a.getAttribute('href')));
  // One name, one destination (SC 2.4.4): the next card is a link to the card, in the strip below 1024 px and under
  // the list from 1024 px, never both on screen and never a jump to the end of this card.
  const next = /\/it\/e\/liquefactive-necrosis\/$/;
  if (width() < 1024) {
    expect(shown.slice(-3, -1)).toEqual(['#quick-check', '#related']);
    expect(shown.at(-1)).toMatch(next);
    await expect(nextEntry).toHaveAttribute('rel', 'next');
    await expect(nextCard).toBeHidden();
  } else {
    expect(shown.slice(-2)).toEqual(['#quick-check', '#related']);
    await expect(nextEntry).toBeHidden();
    await expect(nextCard).toBeVisible();
    await expect(nextCard).toHaveAccessibleName('Scheda successiva: Necrosi colliquativa');
    await expect(nextCard).toHaveAttribute('href', next);
  }
  // The pager's link has the same name for the same card.
  await expect(page.locator('.crumb-row .pager').getByRole('link', { name: 'Scheda successiva: Necrosi colliquativa' })).toHaveAttribute('href', next);
  // Their parts keep the spaces between them ("Scheda successiva: Necrosi colliquativa →", "← Necrosi caseosa"):
  // set as separate flex items, the spaces were dropped.
  const gaps = await page.evaluate(() => {
    /** The box of the last (or first) visible character of a node. */
    const glyph = (n: Node, last: boolean) => {
      const walker = document.createTreeWalker(n, NodeFilter.SHOW_TEXT);
      const all: Text[] = n.nodeType === Node.TEXT_NODE ? [n as Text] : [];
      for (let t = walker.nextNode(); t; t = walker.nextNode()) all.push(t as Text);
      const t = (last ? all.reverse() : all).find((x) => /\S/.test(x.data))!;
      const i = last ? t.data.search(/\S\s*$/) : t.data.search(/\S/);
      const range = document.createRange();
      range.setStart(t, i);
      range.setEnd(t, i + 1);
      return range.getBoundingClientRect();
    };
    const between = (a: Node, b: Node) => {
      const [end, start] = [glyph(a, true), glyph(b, false)];
      return Math.abs(start.top - end.top) < 2 ? start.left - end.right : 99; // on one line only
    };
    const prev = document.querySelector('.crumb-row .pager a')!;
    const out = [between(prev.firstElementChild!, prev.lastChild!)];
    const entry = document.querySelector('.section-toc li[data-next-entry] a > span')!;
    if (entry.checkVisibility()) out.push(between(entry.firstChild!, entry.querySelector('[data-next-name]')!));
    return out;
  });
  for (const gap of gaps) expect(gap).toBeGreaterThan(2);
  // The section spy never marks the link to another card.
  await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
  await expect(list.locator('a[aria-current]')).toHaveAttribute('href', /^#/);
  // Reached through a lens, the link leads to the next card of that lens.
  await page.goto('it/e/coagulative-necrosis/?via=system:heart');
  const lensNext = width() < 1024 ? list.getByRole('link', { name: 'Scheda successiva: Steatosi (degenerazione grassa)' }) : nextCard;
  await expect(lensNext).toHaveAttribute('href', /\/fatty-change\/\?via=system:heart$/);
  await expect(lensNext).toHaveAccessibleName('Scheda successiva: Steatosi (degenerazione grassa)');
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
