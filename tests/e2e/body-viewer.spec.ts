/** The body page, viewer part (docs/BODY_SPEC.md §9): selection, load rule, no WebGL, context lost, reduced motion, layout shift, axe. */
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const WIDE_PX = 768; // 48rem
const BODY = 'ap-body';

const isWide = (page: Page) => page.viewportSize()!.width >= WIDE_PX;

/** Waits for the element script, so that a click is not lost before its listeners exist. */
const ready = (page: Page) => page.waitForFunction(() => !!customElements.get('ap-body'));

/** Taps `[data-load]`: the fixed bottom bar can cover the button, so the click is dispatched. */
async function tapLoad(page: Page) {
  await ready(page);
  await page.locator('[data-load]').dispatchEvent('click');
}

/** Waits for the viewer to settle (on or off); true when it is on. Firefox and WebKit runners may have no WebGL. */
async function settle(page: Page): Promise<boolean> {
  try {
    await page.waitForFunction(() => ['on', 'off'].includes(document.querySelector('ap-body')?.getAttribute('data-webgl') ?? ''), null, { timeout: 30_000 });
  } catch {
    return false;
  }
  return (await page.locator(BODY).getAttribute('data-webgl')) === 'on';
}

/** Opens the body page and starts the viewer: by itself from 48rem, by a tap below it. */
async function startViewer(page: Page, lang: string): Promise<boolean> {
  await page.goto(`${lang}/body/`);
  if (!isWide(page)) await tapLoad(page);
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

/** A published organ the viewer can show, with its system and the name its link carries. */
async function pickOrgan(page: Page) {
  return page.evaluate(() => {
    const organs = [...document.querySelectorAll<HTMLElement>('ap-body section[data-system] > section[data-organ]')].filter((o) => o.querySelector('.body-cards li'));
    const o = organs.find((x) => x.dataset.kind === 'mesh') ?? organs.find((x) => x.dataset.kind !== 'none');
    if (!o) return null;
    return { organ: o.dataset.organ!, system: o.parentElement!.dataset.system!, name: o.querySelector('h3 a')!.textContent!.trim() };
  });
}

const chip = (page: Page, system: string) => page.locator(`.body-systems a[data-system="${system}"]`);
const organLink = (page: Page, organ: string) => page.locator(`section[data-organ="${organ}"] > h3 a`);
const postersShown = (page: Page) => page.evaluate(() => [...document.querySelectorAll<HTMLElement>('[data-poster]')].every((p) => !p.hidden));

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}

for (const lang of ['it', 'en'] as const) {
  test.describe(`body viewer (${lang})`, () => {
    test('a chip sets the system and shows only its section', async ({ page }) => {
      const on = await startViewer(page, lang);
      test.skip(!on, 'no WebGL on this runner');
      const pick = (await pickOrgan(page))!;
      await chip(page, pick.system).dispatchEvent('click');
      await expect(page.locator(BODY)).toHaveAttribute('data-system', pick.system);
      await expect(page.locator(`${BODY} > section[data-system]:not([hidden])`)).toHaveCount(1);
      await expect(page.locator(`${BODY} > section[data-system="${pick.system}"]`)).toBeVisible();
    });

    test('an organ link sets the organ and the label shows its name', async ({ page }) => {
      const on = await startViewer(page, lang);
      test.skip(!on, 'no WebGL on this runner');
      const pick = (await pickOrgan(page))!;
      await chip(page, pick.system).dispatchEvent('click');
      await organLink(page, pick.organ).dispatchEvent('click');
      await expect(page.locator(BODY)).toHaveAttribute('data-organ', pick.organ);
      await expect(page.locator(`${BODY} [data-label]`)).toHaveText(pick.name);
    });

    test(']: next organ, no scroll below 48rem; Escape keeps the system; Back restores the organ', async ({ page }) => {
      const on = await startViewer(page, lang);
      test.skip(!on, 'no WebGL on this runner');
      const pick = (await pickOrgan(page))!;
      await chip(page, pick.system).dispatchEvent('click');
      await organLink(page, pick.organ).dispatchEvent('click');
      await expect(page.locator(BODY)).toHaveAttribute('data-organ', pick.organ);
      const hashWithOrgan = await page.evaluate(() => location.hash);

      await page.locator('[data-stage]').evaluate((el) => (el as HTMLElement).focus({ preventScroll: true }));
      await scrollSettled(page);
      const y = await page.evaluate(() => scrollY);
      await page.keyboard.press(']');
      await expect(page.locator(BODY)).not.toHaveAttribute('data-organ', pick.organ);
      if (!isWide(page)) expect(await page.evaluate(() => scrollY)).toBe(y);

      await page.keyboard.press('Escape');
      await expect(page.locator(BODY)).not.toHaveAttribute('data-organ', /.+/);
      expect(await page.locator(BODY).getAttribute('data-system')).toBeTruthy();

      // Escape and ] each pushed an entry: two steps back reach the organ chosen by the link.
      await page.goBack();
      await page.goBack();
      await expect(page.locator(BODY)).toHaveAttribute('data-organ', pick.organ);
      expect(await page.evaluate(() => location.hash)).toBe(hashWithOrgan);
    });

    test('load rule: below 48rem it waits for a tap; off turns it off for good; load starts it again', async ({ page }) => {
      await page.goto(`${lang}/body/`);
      if (!isWide(page)) {
        await page.waitForTimeout(3000);
        expect(await page.locator(BODY).getAttribute('data-webgl')).not.toBe('on');
        await tapLoad(page);
      }
      const on = await settle(page);
      test.skip(!on, 'no WebGL on this runner');

      await page.locator('[data-off]').dispatchEvent('click');
      await expect(page.locator(BODY)).toHaveAttribute('data-webgl', 'off');
      expect(await postersShown(page)).toBe(true);

      await page.reload();
      await ready(page);
      await page.waitForTimeout(3000);
      expect(await page.locator(BODY).getAttribute('data-webgl')).not.toBe('on');

      await tapLoad(page);
      await expect(page.locator(BODY)).toHaveAttribute('data-webgl', 'on', { timeout: 30_000 });
    });

    test('no WebGL: posters, tree and status stay, data-webgl is off, no page error', async ({ page }) => {
      const errors = collectErrors(page);
      await page.addInitScript(() => {
        HTMLCanvasElement.prototype.getContext = () => null;
      });
      await page.goto(`${lang}/body/`);
      if (!isWide(page)) await tapLoad(page);
      await expect(page.locator(BODY)).toHaveAttribute('data-webgl', 'off', { timeout: 30_000 });
      expect(await postersShown(page)).toBe(true);
      expect(await page.locator('.body-systems a[data-system]').count()).toBeGreaterThan(0);
      await expect(page.locator('[data-status]')).not.toBeEmpty();
      expect(errors).toEqual([]);
    });

    test('context lost: poster back, data-webgl off, status not empty', async ({ page }) => {
      const on = await startViewer(page, lang);
      test.skip(!on, 'no WebGL on this runner');
      const lost = await page.locator('[data-canvas]').evaluate((c) => {
        const canvas = c as HTMLCanvasElement;
        const gl = (canvas.getContext('webgl2') ?? canvas.getContext('webgl')) as WebGL2RenderingContext | null;
        const ext = gl?.getExtension('WEBGL_lose_context');
        ext?.loseContext();
        return !!ext;
      });
      test.skip(!lost, 'this runner has no WEBGL_lose_context');
      await expect(page.locator(BODY)).toHaveAttribute('data-webgl', 'off');
      expect(await postersShown(page)).toBe(true);
      await expect(page.locator('[data-status]')).not.toBeEmpty();
    });

    test('reduced motion: a chip click reports the system at once', async ({ page }) => {
      const errors = collectErrors(page);
      await page.emulateMedia({ reducedMotion: 'reduce' });
      const on = await startViewer(page, lang);
      test.skip(!on, 'no WebGL on this runner');
      const pick = (await pickOrgan(page))!;
      const name = await chip(page, pick.system).evaluate((a) => a.firstChild!.textContent!.trim());
      await chip(page, pick.system).dispatchEvent('click');
      await expect(page.locator('[data-status]')).toContainText(name, { timeout: 2000 });
      expect(errors).toEqual([]);
    });

    test('layout shift is 0 from load until the viewer is on (Chromium)', async ({ page, browserName }) => {
      test.skip(browserName !== 'chromium', 'Layout Instability API: Chromium only');
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
      const on = await startViewer(page, lang);
      test.skip(!on, 'no WebGL on this runner');
      await page.waitForTimeout(500);
      const r = await page.evaluate(() => {
        const w = window as unknown as { __cls: number; __shifts: string[] };
        return { cls: w.__cls, shifts: w.__shifts };
      });
      expect(r.cls, r.shifts.join(' | ')).toBe(0);
    });

    test('axe: no violation with the viewer on and an organ selected', async ({ page }) => {
      const on = await startViewer(page, lang);
      test.skip(!on, 'no WebGL on this runner');
      const pick = (await pickOrgan(page))!;
      await chip(page, pick.system).dispatchEvent('click');
      await organLink(page, pick.organ).dispatchEvent('click');
      await expect(page.locator(BODY)).toHaveAttribute('data-organ', pick.organ);
      const { violations } = await new AxeBuilder({ page }).withTags(WCAG).analyze();
      expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`)).toEqual([]);
    });

    test('axe: no violation with the viewer off', async ({ page }) => {
      await page.addInitScript(() => localStorage.setItem('ap-body-3d', 'off'));
      await page.goto(`${lang}/body/`);
      await ready(page);
      const { violations } = await new AxeBuilder({ page }).withTags(WCAG).analyze();
      expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`)).toEqual([]);
    });
  });
}
