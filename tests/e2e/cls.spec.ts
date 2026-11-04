/**
 * Layout stability ("CLS stays 0") on the pages filled after paint: the oral
 * simulator (hydrated island), the study hub (resume card, due count and
 * backup reminder read from IndexedDB) and the top bar's shortcut hint
 * (rewritten for Apple devices). Chromium only: it is the
 * engine with the Layout Instability API, and the only one where CDP can slow
 * the CPU (4×) so hydration lands after first paint, as on a mid-range phone.
 */
import { expect, test, type Page } from '@playwright/test';

test.beforeEach(({ browserName }) => test.skip(browserName !== 'chromium', 'Layout Instability API and CPU throttling: Chromium only'));

async function cls(page: Page, path: string) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await page.addInitScript(() => {
    const w = window as unknown as { __cls: number; __shifts: string[] };
    w.__cls = 0;
    w.__shifts = [];
    new PerformanceObserver((list) => {
      for (const e of list.getEntries() as (PerformanceEntry & { value: number; hadRecentInput: boolean; sources?: { node?: Node }[] })[]) {
        if (e.hadRecentInput) continue;
        w.__cls += e.value;
        w.__shifts.push((e.sources ?? []).map((s) => (s.node as Element | undefined)?.className || s.node?.nodeName).join(','));
      }
    }).observe({ type: 'layout-shift', buffered: true });
  });
  await page.goto(path);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);
  const r = await page.evaluate(() => {
    const w = window as unknown as { __cls: number; __shifts: string[] };
    return { cls: w.__cls, shifts: w.__shifts };
  });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  return r;
}

for (const path of ['it/study/oral/', 'en/study/oral/'])
  test(`no layout shift on ${path} (first visit, CPU 4× slower)`, async ({ page }) => {
    const r = await cls(page, path);
    expect(r.cls, r.shifts.join(' | ')).toBe(0);
  });

test('no layout shift when the shortcut hint turns into "⌘ K" on Apple devices (CPU 4× slower)', async ({ page }) => {
  test.skip((test.info().project.metadata.width as number) < 1024, 'the search field and its hint show from 1024 px');
  await page.addInitScript(() => Object.defineProperty(Navigator.prototype, 'platform', { get: () => 'MacIntel' }));
  const r = await cls(page, 'it/');
  expect(r.cls, r.shifts.join(' | ')).toBe(0);
  await expect(page.locator('[data-shortcut-hint]')).toHaveText('⌘ K');
});

/** A returning learner: a recently viewed card and a card in review; `reminder`: first use 30 days ago, never exported. */
async function seedLearner(page: Page, reminder: boolean) {
  await page.goto('it/about/');
  await page.evaluate(
    (reminder) =>
      new Promise<void>((resolve, reject) => {
        const req = indexedDB.open('atlas', 2);
        req.onupgradeneeded = () => {
          const stores = ['cards', 'reviewLog', 'bookmarks', 'notes', 'highlights', 'errors', 'readProgress', 'recent', 'quizAttempts', 'plan', 'settings', 'oralSessions'];
          for (const s of stores) if (!req.result.objectStoreNames.contains(s)) req.result.createObjectStore(s, { keyPath: 'id' });
        };
        req.onsuccess = () => {
          const d = req.result;
          const tx = d.transaction(['recent', 'cards', 'settings'], 'readwrite');
          const now = Date.now();
          tx.objectStore('recent').put({ id: 'apoptosis', names: { it: 'Apoptosi', en: 'Apoptosis' }, module: 'g01', section: 'pathogenesis', at: now, updated: now });
          tx.objectStore('cards').put({ id: 'apoptosis:c1', entity: 'apoptosis', module: 'g01', fsrs: { state: 2, due: now - 1000 }, updated: now });
          if (reminder) tx.objectStore('settings').put({ id: 'firstUse', value: now - 30 * 86_400_000, updated: now });
          tx.oncomplete = () => {
            d.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
        req.onerror = () => reject(req.error);
      }),
    reminder,
  );
}

// The hub block sits below the cards, so on most screens it is below the fold and could not shift anything in
// view. The viewport is sized to show the block and the top of the footer: anything that grows or shrinks after
// paint (due line, resume card, backup reminder) would move the footer and count.
for (const state of ['first visit', 'returning learner', 'learner with a backup reminder'] as const)
  test(`no layout shift on the study hub, block in view, ${state} (CPU 4× slower)`, async ({ page }) => {
    const width = test.info().project.metadata.width as number;
    test.skip(state === 'learner with a backup reminder' && width < 1024, 'below 1024 px the reminder comes last, far below the fold of any real screen');
    if (state !== 'first visit') await seedLearner(page, state === 'learner with a backup reminder');
    await page.goto('it/study/');
    await expect(page.locator('ap-resume > *')).toBeVisible();
    const footer = await page.locator('.site-footer').evaluate((f) => f.getBoundingClientRect().top + scrollY);
    await page.setViewportSize({ width, height: Math.ceil(footer) + 40 });
    const r = await cls(page, 'it/study/');
    expect(r.cls, r.shifts.join(' | ')).toBe(0);
    if (state !== 'first visit') await expect(page.locator('.resume-link')).toBeVisible();
    if (state === 'learner with a backup reminder') await expect(page.locator('.export-reminder')).toBeVisible();
  });
