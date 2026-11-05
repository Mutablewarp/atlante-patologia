/**
 * Keyboard-only use (NAVIGATION_SPEC §7): the skip link comes first and works,
 * the tab order follows the document, focus is always visible and never fully
 * hidden behind the sticky top bar, the section chip strip, the bottom/side navigation
 * or a fixed notice (WCAG 2.4.11).
 */
import { expect, test, type Page } from '@playwright/test';

// macOS WebKit only moves focus to links with Option+Tab (system default).
const tabKey = (browserName: string) => (browserName === 'webkit' && process.platform === 'darwin' ? 'Alt+Tab' : 'Tab');

// v2 pages: the entity card (image viewer, compact pathway, quick check), the pattern page (contents, matrix)
// and the full pathway page (stepper, 3D tools).
const PAGES = ['it/', 'en/atlas/', 'it/about/reading-list/', 'en/search/?q=atlas', 'it/e/apoptosis/', 'en/pattern/p01-necrosis/', 'it/pathways/intrinsic-apoptosis/'];
// The entity card has many controls: walk far enough to cross the viewer and the pathway.
const maxStops = (path: string) => (path.includes('/e/') ? 200 : 80);

// Smooth scrolling would still be moving when focus is measured.
test.use({ reducedMotion: 'reduce' });

type Stop = { tag: string; skip: boolean; label: string; visible: boolean; obscured: boolean; after: boolean; inViewport: boolean; same: boolean; last: boolean };

/**
 * Describe the focused element; `after` = it follows the previous stop in DOM order,
 * `same` = Tab did not move focus, `last` = no tabbable element follows it.
 */
async function focusState(page: Page): Promise<Stop | null> {
  return page.evaluate(async () => {
    // Measure after the browser has applied :focus styles and scrolled. Under heavy load headless Chromium
    // can hold rAF for many seconds (22 s once on it/e/apoptosis/), so a timer bounds the wait.
    await new Promise((r) => {
      requestAnimationFrame(() => requestAnimationFrame(r));
      setTimeout(r, 500);
    });
    const el = document.activeElement as HTMLElement | null;
    if (!el || el === document.body) return null;
    const w = window as unknown as { __prev?: Element };
    const prev = w.__prev;
    w.__prev = el;
    const after = !prev || !!(prev.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING);
    const tabbable = (e: HTMLElement) =>
      e.tabIndex >= 0 && !e.matches(':disabled') && !e.closest('[inert]') && e.checkVisibility({ visibilityProperty: true });
    const candidates = document.querySelectorAll<HTMLElement>(
      'a[href], area[href], button, input, select, textarea, summary, iframe, audio[controls], video[controls], [tabindex], [contenteditable]',
    );
    const last = ![...candidates].some((o) => el.compareDocumentPosition(o) & Node.DOCUMENT_POSITION_FOLLOWING && tabbable(o));
    const cs = getComputedStyle(el);
    const visible =
      (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) >= 2) || (cs.boxShadow !== 'none' && cs.boxShadow !== '');
    const r = el.getBoundingClientRect();
    // Sticky/fixed bars that can cover content: a sample point is hidden when the
    // element painted on top there belongs to one of them (z-index aware).
    const overlays = [...document.querySelectorAll<HTMLElement>('.topbar, .primary-nav, .section-toc, .notices')].filter(
      (o) => !o.contains(el) && /fixed|sticky/.test(getComputedStyle(o).position),
    );
    const pts: [number, number][] = [];
    for (const fx of [0.1, 0.5, 0.9]) for (const fy of [0.1, 0.5, 0.9]) pts.push([r.left + r.width * fx, r.top + r.height * fy]);
    const covered = ([x, y]: [number, number]) => {
      if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) return true;
      const hit = document.elementFromPoint(x, y);
      return !!hit && !el.contains(hit) && overlays.some((o) => o.contains(hit));
    };
    return {
      tag: el.tagName.toLowerCase(),
      skip: el.classList.contains('skip-link'),
      label: (el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 40),
      visible,
      obscured: pts.every(covered),
      after,
      inViewport: r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth,
      same: prev === el,
      last,
    };
  });
}

test('the skip link is the first stop and moves focus to the main content @smoke', async ({ page, browserName }) => {
  await page.goto('it/atlas/');
  await page.keyboard.press(tabKey(browserName));
  const skip = page.locator('.skip-link');
  await expect(skip).toBeFocused();
  await expect(skip).toBeInViewport();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#main$/);
  await expect(page.locator('#main')).toBeFocused();
});

test('no positive tabindex anywhere', async ({ page }) => {
  for (const path of PAGES) {
    await page.goto(path);
    expect(await page.locator('[tabindex]:not([tabindex="0"]):not([tabindex="-1"])').count(), path).toBe(0);
  }
});

/** Tab through the page from the top; returns every problem found. */
async function walk(page: Page, path: string, browserName: string) {
  const problems: string[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < maxStops(path); i++) {
    await page.keyboard.press(tabKey(browserName));
    const s = await focusState(page);
    if (!s) break; // focus left the document: we went all the way round
    // Firefox keeps activeElement on the last element when focus leaves the page, so in
    // Firefox only, a stuck last element ends the walk (a trap there goes unseen);
    // anywhere else, Tab that does not move focus is a keyboard trap (WCAG 2.1.2).
    if (s.same) {
      if (!s.last || browserName !== 'firefox') problems.push(`focus did not move (keyboard trap?) at <${s.tag}> "${s.label}"`);
      break;
    }
    const id = `${s.tag}:${s.label}:${i}`;
    if (seen.has(id)) break;
    seen.add(id);
    if (i > 0 && s.skip) break; // wrapped back to the top
    if (!s.after) problems.push(`tab order goes backwards at <${s.tag}> "${s.label}"`);
    if (!s.visible) problems.push(`no visible focus indicator: <${s.tag}> "${s.label}"`);
    if (s.obscured) problems.push(`focus hidden behind sticky bars (stop ${i}): <${s.tag}> "${s.label}"`);
    if (!s.inViewport && !s.obscured) problems.push(`focused element off screen: <${s.tag}> "${s.label}"`);
  }
  expect(seen.size, 'keyboard reaches several controls').toBeGreaterThan(5);
  return problems;
}

for (const path of PAGES) {
  test(`tab order, visible focus and unobscured focus on ${path}${path === 'it/' ? ' @smoke' : ''}`, async ({ page, browserName }) => {
    await page.goto(path);
    expect(await walk(page, path, browserName)).toEqual([]);
  });
}

test('the learner-database notice never hides the focused control', async ({ context, browserName }) => {
  // An older tab keeps the database open at version 1, so this card's upgrade waits and the notice stays up.
  const old = await context.newPage();
  await old.route('**/__blank__', (r) => r.fulfill({ contentType: 'text/html', body: '<!doctype html><title>blank</title>' }));
  await old.goto('__blank__');
  await old.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const req = indexedDB.open('atlas', 1);
        req.onupgradeneeded = () => {
          for (const s of ['cards', 'reviewLog', 'bookmarks', 'notes', 'highlights', 'errors', 'readProgress', 'recent', 'quizAttempts', 'plan', 'settings'])
            req.result.createObjectStore(s, { keyPath: 'id' });
        };
        req.onsuccess = () => {
          (window as unknown as { held: IDBDatabase }).held = req.result;
          resolve();
        };
        req.onerror = () => reject(req.error);
      }),
  );
  const page = await context.newPage();
  const path = 'it/e/apoptosis/';
  await page.goto(path);
  await expect(page.locator('[data-db-box]')).toBeVisible();
  expect(await walk(page, path, browserName)).toEqual([]);
  await old.close();
});
