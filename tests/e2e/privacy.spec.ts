/**
 * Privacy proof (COMPLIANCE_PLAN §2 item 5): on representative pages every
 * request goes to the site's own origin and no cookie is ever set.
 * Runs once per engine (at 1280px): the result does not depend on the width.
 */
import { expect, test } from '@playwright/test';
import { SAMPLE } from './pages.ts';

test('all requests are same-origin and no cookies are set @smoke', async ({ page, context, baseURL }) => {
  test.skip(test.info().project.metadata.width !== 1280, 'width-independent: runs at 1280px only');
  const origin = new URL(baseURL!).origin;
  const foreign: string[] = [];
  page.on('request', (req) => {
    const u = new URL(req.url());
    if (u.protocol !== 'data:' && u.protocol !== 'blob:' && u.origin !== origin) foreign.push(`${page.url()} → ${req.url()}`);
  });
  for (const path of [...SAMPLE, './']) {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    if (path.includes('search/')) await expect(page.locator('[data-search-status]')).not.toHaveText(/^$|…/);
    // Use the shell: theme toggle and notice dismissal write only to localStorage.
    const toggle = page.locator('[data-theme-toggle]');
    if (await toggle.isVisible()) await toggle.click();
  }
  expect(foreign).toEqual([]);
  expect(await context.cookies()).toEqual([]);
  expect(await page.evaluate(() => document.cookie)).toBe('');
});
