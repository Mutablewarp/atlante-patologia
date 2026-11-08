/**
 * Reading experience (owner decisions O11, O12): no per-page AI badge but an
 * AI line in every footer; sections open by default with "Continue" links;
 * A-/A+ reading size remembered and applied before paint; reading progress;
 * section chips that follow the scroll, on entity and pattern pages; a light
 * entity header at every width; differential tables in a labelled scroll region;
 * form fields never below 16 px (no iOS zoom).
 */
import { expect, test, type Page } from '@playwright/test';

const ENTITY = 'it/e/apoptosis/';
const PATTERN = 'en/pattern/p01-necrosis/';
const width = () => test.info().project.metadata.width as number;

test.use({ reducedMotion: 'reduce' });

/** Characters on the longest rendered line of the visible elements matching `sel`. */
const longestLine = (page: Page, sel: string) =>
  page.evaluate((sel) => {
    let max = 0;
    for (const el of document.querySelectorAll(sel)) {
      if (el.getBoundingClientRect().width < 50 || !el.checkVisibility()) continue; // skips visually hidden status text
      const perLine = new Map<number, number>();
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      const range = document.createRange();
      for (let n = walker.nextNode(); n; n = walker.nextNode())
        for (let i = 0; i < n.textContent!.length; i++) {
          range.setStart(n, i);
          range.setEnd(n, i + 1);
          const r = range.getClientRects()[0];
          if (r?.width) perLine.set(Math.round(r.bottom / 4), (perLine.get(Math.round(r.bottom / 4)) ?? 0) + 1);
        }
      max = Math.max(max, ...perLine.values());
    }
    return max;
  }, sel);

test('lines stay within the reading measure: text, summary, captions, credit lines and lists', async ({ page }) => {
  // About 66 characters per line is the target; 80 is the WCAG 1.4.8 ceiling. Lists with summaries in
  // small type (cards in a pattern, the atlas patterns) count each line in its own type size.
  for (const [path, sel] of [
    [
      ENTITY,
      '.section-body p, .section-body li, .entity-head .lede, figcaption p, .objectives li, .related li, .sources li, ' +
        // the first-launch notice, the names and synonyms, the pathway block's intro and the 3D structure notes
        '.first-notice p, .entity-names dd, .entity-pathway > p, .structure-desc p',
    ],
    [PATTERN, '.prose p, .prose li, .entity-head .lede, figcaption p, .related li, .sources li'],
    ['it/pathways/intrinsic-apoptosis/', '.sources li, .structure-desc p, .pw-steps p'],
    ['it/atlas/', '.pattern-list li'],
  ] as const) {
    await page.goto(path);
    expect(await longestLine(page, sel), path).toBeLessThanOrEqual(80);
  }
});

test('no AI badge on entity and pattern pages; the footer carries the AI line @smoke', async ({ page }) => {
  for (const [path, text, method] of [
    [ENTITY, /Testi generati con l’IA e controllati automaticamente/, /\/it\/about\/method\/$/],
    [PATTERN, /Texts generated with AI and checked automatically/, /\/en\/about\/method\/$/],
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

test('the language entry carries the AI line, linked to the Method page in both languages (no-JS view)', async ({ page }) => {
  // The root page redirects with JavaScript: strip its script to see what a visitor without it sees.
  await page.route(/\/atlante-patologia\/$/, async (route) => {
    const res = await route.fetch();
    await route.fulfill({ response: res, body: (await res.text()).replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '') });
  });
  await page.goto('./');
  const line = page.locator('[data-ai-notice]');
  await expect(line.getByRole('link', { name: 'Come nascono i contenuti' })).toHaveAttribute('href', /\/it\/about\/method\/$/);
  await expect(line.getByRole('link', { name: 'How the content is made' })).toHaveAttribute('href', /\/en\/about\/method\/$/);
});

test('the medical disclaimer is in the footer and the first-launch notice, not repeated on the home page', async ({ page }) => {
  for (const [path, short, notice] of [
    ['it/', 'Solo a scopo didattico', 'Non è uno strumento clinico'],
    ['en/', 'For education only', 'It is not a clinical tool'],
  ] as const) {
    await page.goto(path);
    await expect(page.locator('footer'), path).toContainText(short);
    await expect(page.locator('.first-notice'), path).toContainText(notice);
    await expect(page.locator('main'), path).not.toContainText(short);
  }
});

test('the atlas links each cross-cutting pattern on one readable line, with its summary below', async ({ page }) => {
  await page.goto('it/atlas/');
  const link = page.locator('.pattern-list li > a').first();
  await expect(link).toHaveText('Tipi di necrosi');
  const [lines, width] = await link.evaluate((a) => [a.getClientRects().length, a.getBoundingClientRect().width]);
  expect(lines).toBe(1);
  expect(width).toBeGreaterThan(80); // it was squeezed into a 26-37 px column, broken mid-word
  const summary = (await page.locator('.pattern-list li > span').first().boundingBox())!;
  expect(summary.y).toBeGreaterThan((await link.boundingBox())!.y);
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

  // Collapse all / expand all (behind the tools toggle at every width).
  await page.getByRole('button', { name: 'Strumenti' }).click();
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

test('the site name in the top bar is shown whole or as "Atlante", never cut, at every reading size', async ({ page }) => {
  test.skip(width() >= 1024, 'from 1024 px the name is in the sidebar');
  // Phones are also checked at 320 px, the narrowest common width; tablets from 600 px, where the chapter button
  // and the palette shortcut share the bar.
  for (const w of width() < 600 ? [width(), 320] : [600, 640, 700, 744, width()])
    for (const size of ['m', 'l', 'xl']) {
      await page.setViewportSize({ width: w, height: 700 });
      await page.addInitScript((s) => localStorage.setItem('ap-text', s), size);
      await page.goto(ENTITY);
      const brand = page.locator('.topbar .brand');
      await expect(brand, `${w} ${size}`).toHaveAccessibleName('Atlante di Patologia');
      const shown = await brand.evaluate((a) => {
        const box = a.querySelector('.brand-name')!.getBoundingClientRect();
        const main = a.querySelector<HTMLElement>('.brand-main')!;
        const sub = a.querySelector('.brand-sub')!.getBoundingClientRect();
        if (main.scrollWidth > main.clientWidth) return 'cut';
        if (sub.top >= box.bottom - 1) return 'Atlante'; // "di Patologia" wrapped onto the clipped line
        return sub.right <= box.right + 1 && sub.bottom <= box.bottom + 1 ? 'whole' : 'cut';
      });
      expect(shown, `${w} ${size}`).not.toBe('cut');
    }
});

test('at the larger reading sizes no card scrolls sideways, folded toggles included', async ({ page }) => {
  // The folded "Lenti (n)" toggle floats beside the badges: a badge that does not fit must move below it.
  // Phones are checked down to 320 px; wider projects at their own width.
  for (const path of [ENTITY, 'en/e/coagulative-necrosis/', 'it/e/other-regulated-cell-death/'])
    for (const w of width() < 600 ? [320, 360, 375] : width() < 1024 ? [600, 700, width()] : [width()])
      for (const size of ['l', 'xl']) {
        await page.setViewportSize({ width: w, height: 700 });
        await page.addInitScript((s) => localStorage.setItem('ap-text', s), size);
        await page.goto(path);
        const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(over, `${path} ${w} px, text ${size}`).toBeLessThanOrEqual(0);
      }
});

test('reading progress and the section chips follow the scroll', async ({ page }) => {
  await page.goto(ENTITY);
  const bar = page.locator('[data-read-progress]');
  const scale = () => bar.evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).a);
  expect(await scale()).toBeLessThan(0.05);
  await page.evaluate(() => document.getElementById('pathogenesis')!.scrollIntoView());
  await expect(page.locator('.section-toc a[href="#pathogenesis"]')).toHaveAttribute('aria-current', 'true');
  await expect(page.locator('.section-toc a[aria-current]')).toHaveCount(1);
  await page.evaluate(() => document.getElementById('traps')!.scrollIntoView());
  await expect(page.locator('.section-toc a[href="#traps"]')).toHaveAttribute('aria-current', 'true');
  // With the denser text pathogenesis starts right at 10 % of the card, so the bar is read here, 71-76 % down.
  await expect.poll(scale).toBeGreaterThan(0.5);
  if (width() < 1024) await expect(page.locator('.section-toc a[href="#traps"]')).toBeInViewport();
});

test('a section entry, short sections included, is marked when tapped and while its section is under the reading line', async ({ page }) => {
  // The old spy took the last section in the top 30 % of the screen: tapping "Macroscopia" marked "Microscopia",
  // "Diagnosi" marked "Prognosi", "Colorazioni e IIC" marked "Clinica".
  const current = page.locator('.section-toc a[aria-current]');
  for (const [path, ids] of [
    [ENTITY, ['gross', 'diagnosis', 'etiology', 'traps']],
    ['it/e/coagulative-necrosis/', ['ancillary', 'clinical']],
  ] as const) {
    await page.goto(path);
    for (const id of ids) {
      const entry = page.locator(`.section-toc a[href="#${id}"]`);
      await entry.click();
      await expect(page).toHaveURL(new RegExp(`#${id}$`));
      await expect(entry).toHaveAttribute('aria-current', 'true');
      // Read on by a pixel, past the click's hold: the section under the line is still the tapped one.
      await page.waitForTimeout(300);
      await page.evaluate(() => scrollBy(0, 1));
      await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
      await expect(current, `${path}#${id}`).toHaveAttribute('href', `#${id}`);
      await expect(current).toHaveCount(1);
    }
  }
  // Scrolled by hand until the end of "Macroscopia" is 2 px under the line: the next heading is in the top 30 % of
  // the screen, yet Macroscopia is the section being read.
  await page.goto(ENTITY);
  await page.evaluate(() => {
    const line = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) + 8;
    scrollBy(0, document.getElementById('gross')!.getBoundingClientRect().bottom - (line + 2));
  });
  expect(await page.evaluate(() => document.getElementById('micro')!.getBoundingClientRect().top < innerHeight * 0.3)).toBe(true);
  await expect(current).toHaveAttribute('href', '#gross');
});

test('on tablets the chip strip fades where it hides chips and fills the current chip, at the same width', async ({ page }) => {
  test.skip(width() < 600 || width() >= 1024, 'the chip strip of tablets (600-1023 px)');
  await page.goto(ENTITY);
  const strip = page.locator('.section-toc ol');
  await expect(strip).toHaveAttribute('data-fade', 'end');
  expect(await strip.evaluate((o) => getComputedStyle(o).maskImage)).toContain('gradient');
  const chip = page.locator('.section-toc a[href="#pathogenesis"]');
  const before = (await chip.boundingBox())!.width;
  await page.evaluate(() => document.getElementById('pathogenesis')!.scrollIntoView());
  await expect(chip).toHaveAttribute('aria-current', 'true');
  // Filled like the pressed reading mode ("Completa"), and no wider (CLS 0).
  const fill = (sel: string) => page.locator(sel).evaluate((el) => [getComputedStyle(el).backgroundColor, getComputedStyle(el).color]);
  expect(await fill('.section-toc a[aria-current]')).toEqual(await fill('[data-mode-btn="full"]'));
  expect((await chip.boundingBox())!.width).toBe(before);
  await strip.evaluate((o) => (o.scrollLeft = o.scrollWidth));
  await expect(strip).toHaveAttribute('data-fade', 'start');
});

test('on phones the chip strip slides away while reading down and comes back reading up or on focus', async ({ page }) => {
  test.skip(width() >= 600, 'only below 600 px, where the sticky chrome takes a fifth of the screen');
  await page.goto(ENTITY);
  const html = page.locator('html');
  const strip = page.locator('.section-toc');
  const bar = await page.locator('.topbar').evaluate((t) => t.getBoundingClientRect().bottom);
  const stripBottom = () => strip.evaluate((s) => s.getBoundingClientRect().bottom);
  // In the page flow at the top: scrolling a little never hides it.
  await page.evaluate(() => scrollBy(0, 40));
  await expect(html).not.toHaveAttribute('data-chips');
  await page.evaluate(() => scrollBy(0, document.getElementById('pathogenesis')!.getBoundingClientRect().top));
  await expect(html).toHaveAttribute('data-chips', 'away');
  await expect.poll(stripBottom).toBeLessThanOrEqual(bar + 1); // behind the top bar
  await page.evaluate(() => scrollBy(0, -120));
  await expect(html).not.toHaveAttribute('data-chips');
  await expect.poll(stripBottom).toBeGreaterThan(bar + 40);
  // Away again, a focused chip brings the strip back (keyboard users never tab into a hidden strip).
  await page.evaluate(() => scrollBy(0, 400));
  await expect(html).toHaveAttribute('data-chips', 'away');
  await strip.getByRole('link').first().focus();
  await expect.poll(stripBottom).toBeGreaterThan(bar + 40);
});

test('the pattern page has the contents of entity pages: chips on phones and tablets, a side list on desktop', async ({ page }) => {
  await page.goto(PATTERN);
  const toc = page.getByRole('navigation', { name: 'On this page' });
  const links = toc.getByRole('link');
  // The text's H2s (label cut at a colon or bracket), then the matrix, images and cards.
  await expect(links.first()).toHaveText('Overview');
  await expect(toc.getByRole('link', { name: 'How to recognize it', exact: true })).toHaveAttribute('href', '#how-to-recognize-it-low-to-high-power');
  await expect(links.last()).toHaveText('Cards in this pattern');
  const [nav, text] = [(await toc.boundingBox())!, (await page.locator('.prose').boundingBox())!];
  if (width() >= 1024) {
    expect(nav.x).toBeGreaterThan(text.x + text.width); // beside the text
    // The comparison matrix, the page's main tool, takes the full width: under the side list too.
    const matrix = (await page.locator('.pattern-matrix .table-scroll').boundingBox())!;
    expect(matrix.x + matrix.width).toBeGreaterThanOrEqual(nav.x + nav.width - 1);
    // The sticky list ends with the text: read through, the matrix is never under it (SC 2.4.11).
    await page.locator('.pattern-matrix .table-scroll').evaluate((m) => m.scrollIntoView({ block: 'center' }));
    const [list, table] = await page.evaluate(() =>
      ['.section-toc', '.pattern-matrix .table-scroll'].map((s) => document.querySelector(s)!.getBoundingClientRect().toJSON() as DOMRect),
    );
    expect(list!.bottom <= table!.top || list!.right <= table!.left, 'side list over the matrix').toBe(true);
  } else expect(nav.y + nav.height).toBeLessThanOrEqual(text.y); // above it, then sticky

  // A chip lands its heading below the top bar and the sticky strip (SC 2.4.11), and becomes current.
  const comparison = toc.getByRole('link', { name: 'Comparison' });
  await comparison.click();
  await expect(comparison).toHaveAttribute('aria-current', 'true');
  const heading = (await page.locator('#matrix-title').boundingBox())!;
  // The lowest sticky bar over the text: the chip strip below 1024 px, the top bar above.
  const cover = await page.evaluate((wide) => document.querySelector(wide ? '.topbar' : '.section-toc')!.getBoundingClientRect().bottom, width() >= 1024);
  expect(heading.y).toBeGreaterThanOrEqual(cover - 1);
  await page.evaluate(() => document.getElementById('pitfalls')!.scrollIntoView());
  await expect(toc.getByRole('link', { name: 'Pitfalls' })).toHaveAttribute('aria-current', 'true');
  await expect(toc.locator('a[aria-current]')).toHaveCount(1);
});

test('lenses, less used tools and objectives fold behind toggles at every width, closed from the first paint', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('ap-disclaimer', '1')); // past the one-time first-launch notice
  await page.goto(ENTITY);
  await expect(page.locator('[data-fold]')).toHaveCount(3);
  // Phones: the first paragraph of the definition was 2.1-2.7 phone screens down; now about one (844 px tall phone).
  // Tablets and computers: its first line is on the first screen (it was 1.2-1.7 screens down).
  const [top, bottom, screen] = await page
    .locator('#definition .section-body p')
    .first()
    .evaluate((p) => [p.getBoundingClientRect().top + scrollY, p.getBoundingClientRect().top + scrollY + parseFloat(getComputedStyle(p).lineHeight), innerHeight]);
  if (width() < 600) expect(top).toBeLessThan(844 * 1.25);
  else expect(bottom).toBeLessThanOrEqual(screen);
  for (const [name, inside] of [
    [/^Lenti \(\d+\)$/, '.lens-chips'],
    ['Strumenti', '#entity-tools [data-print]'],
    ['Obiettivi di apprendimento', '#objectives-list'],
  ] as const) {
    const toggle = page.getByRole('button', { name, exact: true });
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator(inside)).toBeHidden();
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator(inside)).toBeVisible();
  }
  // The study actions open with the tools.
  await expect(page.locator('#entity-tools .entity-actions')).toBeAttached();
  await expect(page.locator('#entity-tools .entity-actions')).not.toHaveCSS('display', 'none');
  // Bookmark and quiz: in the toolbar row from 600 px (one copy only in the accessibility tree), behind "Tools" on phones.
  const bookmark = page.getByRole('button', { name: /Segnalibro/ });
  const quiz = page.getByRole('link', { name: 'Quiz su questa scheda' });
  await expect(bookmark).toHaveCount(1);
  await expect(quiz).toHaveCount(1);
  for (const control of [bookmark, quiz]) {
    expect(await control.evaluate((el) => !!el.closest('#entity-tools')), 'inside the tools fold').toBe(width() < 600);
    await expect(control).toBeVisible();
  }
});

test('the reading toolbar keeps one row from 768 px: mode, A-/A+, bookmark, quiz and tools', async ({ page }) => {
  test.skip(width() < 768, 'phones: mode, A-/A+ and tools only (the bookmark and the quiz are behind the tools)');
  await page.goto(ENTITY);
  const boxes = await page
    .locator('.entity-toolbar :is(.segmented, .text-size, .entity-pinned > *, .fold-toggle)')
    .evaluateAll((els) => els.filter((e) => e.checkVisibility()).map((e) => e.getBoundingClientRect().toJSON() as DOMRect));
  expect(boxes).toHaveLength(5); // Quick/Full, the A-/A+ pair, bookmark, quiz, tools
  const tops = boxes.map((b) => b.top);
  expect(Math.max(...tops) - Math.min(...tops), 'one row').toBeLessThan(boxes[0]!.height / 2);
});

/** Median characters of the full lines (the last line of each paragraph excluded) of the card's running text. */
const medianLine = (page: Page) =>
  page.evaluate(() => {
    const counts: number[] = [];
    const range = document.createRange();
    for (const p of document.querySelectorAll('.entity-section:not([data-callout]) .section-body > p')) {
      if (!p.checkVisibility()) continue;
      const lines = new Map<number, number>();
      const walker = document.createTreeWalker(p, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode())
        for (let i = 0; i < n.textContent!.length; i++) {
          range.setStart(n, i);
          range.setEnd(n, i + 1);
          const r = range.getClientRects()[0];
          if (r?.width) lines.set(Math.round(r.bottom / 4), (lines.get(Math.round(r.bottom / 4)) ?? 0) + 1);
        }
      counts.push(...[...lines.entries()].sort((a, b) => a[0] - b[0]).map((e) => e[1]).slice(0, -1));
    }
    counts.sort((a, b) => a - b);
    return counts[Math.floor(counts.length / 2)]!;
  });

test('the reading measure holds 62-70 characters per line on tablets and computers', async ({ page }) => {
  test.skip(width() < 600, 'phones: the screen, not the measure, sets the line length');
  await page.goto(ENTITY);
  const median = await medianLine(page);
  expect(median).toBeGreaterThanOrEqual(62);
  expect(median).toBeLessThanOrEqual(70);
});

test('from 1024 px the text keeps 60 characters a line beside the side list; from 1280 px text and list are one centred block', async ({ page }) => {
  test.skip(width() !== 1280, 'one run per engine: the test sets its own widths');
  for (const viewport of [
    { width: 1024, height: 1366 }, // iPad Pro 12.9 in portrait, sidebar open: 52 characters a line before
    { width: 1180, height: 820 },
    { width: 1440, height: 900 },
    { width: 1920, height: 1080 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto(ENTITY);
    const median = await medianLine(page);
    expect(median, `${viewport.width} px`).toBeGreaterThanOrEqual(60);
    expect(median, `${viewport.width} px`).toBeLessThanOrEqual(70);
    if (viewport.width < 1280) continue;
    // No empty band between the text and the list: the gap and the room of the section toggles only (6rem).
    const [text, list, page_, main] = await page.evaluate(() =>
      ['#definition-body > p', '.section-toc', '.page', 'main'].map((s) => document.querySelector(s)!.getBoundingClientRect().toJSON() as DOMRect),
    );
    expect(list!.left - text!.right, `${viewport.width} px: text to list`).toBeLessThanOrEqual(6 * 16 + 2);
    // The block sits in the middle of the reading area, and the breadcrumb and the header start where the text starts.
    const pad = parseFloat(await page.evaluate(() => getComputedStyle(document.querySelector('main')!).paddingLeft));
    expect(Math.abs(page_!.left - (main!.left + pad) - (main!.right - pad - page_!.right)), `${viewport.width} px: centred`).toBeLessThanOrEqual(2);
    for (const sel of ['.crumb-row', '.entity-head h1'])
      expect(Math.abs((await page.locator(sel).boundingBox())!.x - text!.left), `${viewport.width} px: ${sel}`).toBeLessThanOrEqual(1);
  }
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
