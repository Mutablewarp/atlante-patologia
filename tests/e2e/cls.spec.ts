/**
 * Layout stability ("CLS stays 0") on the pages filled after paint: the oral
 * simulator (hydrated island) and the study hub for a returning learner
 * (resume card and due count read from IndexedDB). Chromium only: it is the
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

test('no layout shift on the study hub for a returning learner (CPU 4× slower)', async ({ page }) => {
  // Make this a returning learner: a recently viewed card and a card in review.
  await page.goto('it/about/');
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const req = indexedDB.open('atlas', 2);
        req.onupgradeneeded = () => {
          const stores = ['cards', 'reviewLog', 'bookmarks', 'notes', 'highlights', 'errors', 'readProgress', 'recent', 'quizAttempts', 'plan', 'settings', 'oralSessions'];
          for (const s of stores) if (!req.result.objectStoreNames.contains(s)) req.result.createObjectStore(s, { keyPath: 'id' });
        };
        req.onsuccess = () => {
          const d = req.result;
          const tx = d.transaction(['recent', 'cards'], 'readwrite');
          const now = Date.now();
          tx.objectStore('recent').put({ id: 'apoptosis', names: { it: 'Apoptosi', en: 'Apoptosis' }, module: 'g01', section: 'pathogenesis', at: now, updated: now });
          tx.objectStore('cards').put({ id: 'apoptosis:c1', entity: 'apoptosis', module: 'g01', fsrs: { state: 2, due: now - 1000 }, updated: now });
          tx.oncomplete = () => {
            d.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
        req.onerror = () => reject(req.error);
      }),
  );
  const r = await cls(page, 'it/study/');
  expect(r.cls, r.shifts.join(' | ')).toBe(0);
  await expect(page.locator('.resume-link')).toBeVisible();
});
