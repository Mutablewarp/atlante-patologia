/** The body on a phone (docs/BODY_SPEC.md §9, phone rows): home page order, load by tap, chips, organ list, sheet, no side scroll, layout shift, axe. */
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

test.use({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });

const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const BODY = 'ap-body';
const SCREEN = 812;

test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-375' || testInfo.project.metadata.engine !== 'chromium', 'phone rows run in chromium-375 only');
});

/** Waits for the element script, so that a click is not lost before its listeners exist. */
const ready = (page: Page) => page.waitForFunction(() => !!customElements.get('ap-body'));

/** Taps `[data-load]`: the fixed bottom bar can cover the button, so the click is dispatched. */
async function tapLoad(page: Page) {
  await ready(page);
  await page.locator('[data-load]').dispatchEvent('click');
}

/** Waits for the viewer to settle (on or off); true when it is on. A runner may have no WebGL. */
async function settle(page: Page): Promise<boolean> {
  try {
    await page.waitForFunction(() => ['on', 'off'].includes(document.querySelector('ap-body')?.getAttribute('data-webgl') ?? ''), null, { timeout: 30_000 });
  } catch {
    return false;
  }
  return (await page.locator(BODY).getAttribute('data-webgl')) === 'on';
}

/** Opens the body page and starts the viewer by a tap. */
async function startViewer(page: Page, lang: string): Promise<boolean> {
  await page.goto(`${lang}/body/`);
  await tapLoad(page);
  return settle(page);
}

/** Waits until the page stops scrolling: a link to a fragment scrolls smoothly, and a position read too early is not final. */
async function scrollSettled(page: Page) {
  let last = -1;
  await expect
    .poll(async () => {
      const y = await page.evaluate(() => scrollY);
      const still = y === last;
      last = y;
      return still;
    }, { intervals: [200], timeout: 10_000 })
    .toBe(true);
}

/** A published organ the viewer can show, with its system and the name its link carries (body page). */
async function pickOrgan(page: Page) {
  return page.evaluate(() => {
    const organs = [...document.querySelectorAll<HTMLElement>('ap-body section[data-system] > section[data-organ]')].filter((o) => o.querySelector('.body-cards li'));
    const o = organs.find((x) => x.dataset.kind === 'mesh') ?? organs.find((x) => x.dataset.kind !== 'none');
    if (!o) return null;
    return { organ: o.dataset.organ!, system: o.parentElement!.dataset.system!, name: o.querySelector('h3 a')!.textContent!.trim() };
  });
}

/** An organ of the home list that has cards, with its system. */
async function pickHomeOrgan(page: Page) {
  return page.evaluate(() => {
    const o = [...document.querySelectorAll<HTMLElement>('.body-home section[data-system] li[data-organ]')].find((x) => Number(x.dataset.count) > 0);
    return o ? { organ: o.dataset.organ!, system: o.closest<HTMLElement>('section[data-system]')!.dataset.system! } : null;
  });
}

const chip = (page: Page, system: string) => page.locator(`.body-systems a[data-system="${system}"]`);
const organLink = (page: Page, organ: string) => page.locator(`section[data-organ="${organ}"] > h3 a`);
const sheet = (page: Page, organ: string) => page.locator(`section[data-organ="${organ}"]`);

/** Starts the Layout Instability observer before the first navigation. */
async function observeShifts(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __cls: number; __shifts: string[] };
    w.__cls = 0;
    w.__shifts = [];
    new PerformanceObserver((list) => {
      for (const e of list.getEntries() as (PerformanceEntry & { value: number; hadRecentInput: boolean; sources?: { node?: Node }[] })[]) {
        if (e.hadRecentInput) continue;
        w.__cls += e.value;
        w.__shifts.push((e.sources ?? []).map((s) => String((s.node as Element | undefined)?.className || s.node?.nodeName)).join(',') + ` @${Math.round(e.startTime)}ms`);
      }
    }).observe({ type: 'layout-shift', buffered: true });
  });
}

/** Opens the sheet: starts the viewer, taps the chip of a system, then the link of one organ. Null when WebGL is off. */
async function openSheet(page: Page, lang: string) {
  const on = await startViewer(page, lang);
  if (!on) return null;
  const pick = (await pickOrgan(page))!;
  await chip(page, pick.system).dispatchEvent('click');
  await organLink(page, pick.organ).dispatchEvent('click');
  await expect(page.locator(BODY)).toHaveAttribute('data-organ', pick.organ);
  await expect(page.locator(BODY)).toHaveAttribute('data-picked', '');
  return pick;
}

const noSideScroll = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth === document.documentElement.clientWidth);

for (const lang of ['it', 'en'] as const) {
  test.describe(`body on a phone (${lang})`, () => {
    test('home: the description, then the stage, inside the first two screens', async ({ page }) => {
      await page.goto(`${lang}/`);
      const intro = (await page.locator('.body-intro').boundingBox())!;
      const stage = (await page.locator('.body-home [data-stage]').boundingBox())!;
      expect(intro.y + intro.height).toBeLessThanOrEqual(stage.y);
      expect(intro.y + intro.height).toBeLessThan(2 * SCREEN);
      expect(stage.y).toBeLessThan(2 * SCREEN);
    });

    test('home: a tap on "Explore in 3D" sets data-webgl, then the canvas is shown', async ({ page }) => {
      await page.goto(`${lang}/`);
      await tapLoad(page);
      const on = await settle(page);
      test.skip(!on, 'no WebGL on this runner');
      await expect(page.locator('.body-home canvas')).toHaveCount(1);
      await expect(page.locator('.body-home canvas')).toBeVisible();
    });

    test('home: a chip tap shows the organ list of that system in place', async ({ page }) => {
      await page.goto(`${lang}/`);
      await ready(page);
      const pick = (await pickHomeOrgan(page))!;
      const before = await page.evaluate(() => scrollY);
      await chip(page, pick.system).dispatchEvent('click');
      const list = page.locator(`.body-home section[data-system="${pick.system}"]`);
      await expect(list).toHaveAttribute('data-open', '');
      await expect(list).toBeVisible();
      await expect(page.locator('.body-home section[data-system][data-open]')).toHaveCount(1);
      await expect(list.locator(`li[data-organ="${pick.organ}"] a[data-organ-link]`)).toBeVisible();
      expect(Math.abs((await page.evaluate(() => scrollY)) - before)).toBeLessThanOrEqual(2);
    });

    test('home: an organ link opens the body page on that organ', async ({ page }) => {
      await page.goto(`${lang}/`);
      await ready(page);
      const pick = (await pickHomeOrgan(page))!;
      await chip(page, pick.system).dispatchEvent('click');
      await page.locator(`.body-home li[data-organ="${pick.organ}"] a[data-organ-link]`).tap();
      await page.waitForURL(new RegExp(`/${lang}/body/#.*organ-${pick.organ}`));
      await expect(sheet(page, pick.organ)).toHaveCount(1);
      await tapLoad(page);
      const on = await settle(page);
      test.skip(!on, 'no WebGL on this runner');
      await expect(page.locator(BODY)).toHaveAttribute('data-organ', pick.organ);
    });

    test('the sheet is fixed at the bottom and its close button closes it', async ({ page }) => {
      const pick = await openSheet(page, lang);
      test.skip(!pick, 'no WebGL on this runner');
      const section = sheet(page, pick!.organ);
      await expect(section).toBeVisible();
      expect(await section.evaluate((s) => getComputedStyle(s).position)).toBe('fixed');
      const box = (await section.boundingBox())!;
      const bar = (await page.locator('.nav-list').boundingBox())!; // below 600 px the sheet rests on the tab bar
      expect(Math.abs(box.y + box.height - bar.y)).toBeLessThanOrEqual(2);
      expect(bar.y + bar.height).toBeGreaterThanOrEqual(SCREEN - 2);
      await section.locator(':scope > .body-sheet-close').dispatchEvent('click');
      await expect(page.locator(BODY)).not.toHaveAttribute('data-organ', pick!.organ);
      expect(await section.evaluate((s) => getComputedStyle(s).position)).not.toBe('fixed');
    });

    test('no horizontal scroll on the home page, the body page and the open sheet', async ({ page }) => {
      await page.goto(`${lang}/`);
      await ready(page);
      expect(await noSideScroll(page)).toBe(true);
      const pick = await openSheet(page, lang);
      expect(await noSideScroll(page)).toBe(true);
      if (pick) {
        await scrollSettled(page);
        expect(await noSideScroll(page)).toBe(true);
      }
    });

    test('layout shift is 0 while the viewer starts (home)', async ({ page }) => {
      await observeShifts(page);
      await page.goto(`${lang}/`);
      await tapLoad(page);
      const on = await settle(page);
      test.skip(!on, 'no WebGL on this runner');
      await page.waitForTimeout(500);
      const r = await page.evaluate(() => {
        const w = window as unknown as { __cls: number; __shifts: string[] };
        return { cls: w.__cls, shifts: w.__shifts };
      });
      expect(r.cls, r.shifts.join(' | ')).toBe(0);
    });

    test('axe: no violation with the sheet open', async ({ page }) => {
      const pick = await openSheet(page, lang);
      test.skip(!pick, 'no WebGL on this runner');
      await scrollSettled(page);
      await expect(organLink(page, pick!.organ)).toHaveAttribute('aria-current', 'true');
      const { violations } = await new AxeBuilder({ page }).withTags(WCAG).analyze();
      expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`)).toEqual([]);
    });
  });
}
