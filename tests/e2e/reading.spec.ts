/**
 * Reading experience (owner decisions O11, O12): no per-page AI badge but an
 * AI line in every footer; sections open by default with "Continue" links;
 * A-/A+ reading size remembered and applied before paint; reading progress;
 * section chips that follow the scroll, on entity and pattern pages; a light
 * entity header on phones; differential tables in a labelled scroll region;
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
    [ENTITY, '.section-body p, .section-body li, .entity-head .lede, figcaption p, .objectives li, .related li, .sources li'],
    [PATTERN, '.prose p, .prose li, .entity-head .lede, figcaption p, .related li, .sources li'],
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

  // Collapse all / expand all (on phones, behind the tools toggle).
  if (width() < 600) await page.getByRole('button', { name: 'Strumenti' }).click();
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
  // Phones are also checked at 320 px, the narrowest common width.
  for (const w of width() < 600 ? [width(), 320] : [width()])
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

test('the pattern page has the contents of entity pages: chips on phones and tablets, a side list on desktop', async ({ page }) => {
  await page.goto(PATTERN);
  const toc = page.getByRole('navigation', { name: 'On this page' });
  const links = toc.getByRole('link');
  // The text's H2s (label cut at a colon or bracket), then the matrix, images and cards.
  await expect(links.first()).toHaveText('Overview');
  await expect(toc.getByRole('link', { name: 'How to recognize it', exact: true })).toHaveAttribute('href', '#how-to-recognize-it-low-to-high-power');
  await expect(links.last()).toHaveText('Cards in this pattern');
  const [nav, text] = [(await toc.boundingBox())!, (await page.locator('.prose').boundingBox())!];
  if (width() >= 1024) expect(nav.x).toBeGreaterThan(text.x + text.width); // beside the text
  else expect(nav.y + nav.height).toBeLessThanOrEqual(text.y); // above it, then sticky

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

test('on phones the card text starts about a screen down: lenses, tools and objectives fold behind toggles', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('ap-disclaimer', '1')); // past the one-time first-launch notice
  await page.goto(ENTITY);
  const folds = page.locator('[data-fold]');
  await expect(folds).toHaveCount(3);
  if (width() >= 600) {
    for (const f of await folds.all()) await expect(f).toBeHidden();
    for (const shown of ['.lens-chips', '#entity-tools [data-print]', '#objectives-list']) await expect(page.locator(shown)).toBeVisible();
    return;
  }
  // The first paragraph of the definition was 2.1-2.7 phone screens down; now about one (844 px tall phone).
  const top = await page.locator('#definition .section-body p').first().evaluate((p) => p.getBoundingClientRect().top + scrollY);
  expect(top).toBeLessThan(844 * 1.25);
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
