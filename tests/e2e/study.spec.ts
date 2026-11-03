/**
 * Smoke tests for the study engine and personal layer on the draft fixtures
 * (placeholder content only). Run: npx playwright test -c tests/e2e/study.config.ts
 */
import { readFileSync } from 'node:fs';
import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// The flows run on draft fixtures; under a production build (no fixtures) the suite skips itself.
test.beforeEach(async ({ request }) => {
  test.skip(!(await request.get('it/e/fixture-demo/')).ok(), 'needs a PREVIEW_DRAFTS=1 build with the draft fixtures');
});

/** Fail on any request that leaves the site's origin (privacy rule: zero third parties). */
function guardRequests(page: Page) {
  const foreign: string[] = [];
  page.on('request', (r) => {
    const u = new URL(r.url());
    if (u.protocol !== 'data:' && u.protocol !== 'blob:' && u.hostname !== 'localhost') foreign.push(r.url());
  });
  return foreign;
}

async function noAxeViolations(page: Page) {
  const res = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  expect(res.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
}

test('entity actions feed review, bookmarks, resume and the Me pages', async ({ page }) => {
  const foreign = guardRequests(page);
  await page.goto('it/e/fixture-demo/');
  const add = page.getByRole('button', { name: 'Aggiungi al ripasso' });
  await add.click();
  await expect(page.getByRole('button', { name: /Nel ripasso \(7\)/ })).toHaveAttribute('aria-pressed', 'true');
  const bm = page.getByRole('button', { name: /Segnalibro/ });
  await bm.click();
  await expect(bm).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('Spiega perché')).toBeVisible();

  await page.goto('it/me/bookmarks/');
  await expect(page.getByRole('link', { name: 'Voce di prova (segnaposto)' })).toBeVisible();
  await page.goto('it/me/');
  await expect(page.locator('ap-resume')).toContainText('Voce di prova (segnaposto)');
  await expect(page.locator('ap-recent')).toContainText('Voce di prova (segnaposto)');
  expect(foreign).toEqual([]);
});

test('review: reveal with Space, rate with keys, progress is saved', async ({ page }) => {
  const foreign = guardRequests(page);
  await page.goto('en/study/review/');
  // The count depends on the published content plus the draft fixtures.
  await expect(page.getByText(/0 due · [1-9]\d* new/)).toBeVisible();
  await noAxeViolations(page);
  await page.keyboard.press('Space');
  await expect(page.getByRole('group', { name: 'How easy was it to recall?' })).toBeVisible();
  await page.keyboard.press('3');
  await expect(page.getByText('Card 2 of', { exact: false })).toBeVisible();
  await page.goto('en/study/');
  await expect(page.locator('ap-due-count')).toHaveText('Due today: 1');
  expect(foreign).toEqual([]);
});

test('quiz: immediate feedback explains every option and links back', async ({ page }) => {
  await page.goto('en/study/quiz/?mode=topic');
  await page.getByRole('spinbutton', { name: 'Number of questions' }).fill('3');
  await page.getByRole('button', { name: 'Start' }).click();
  const first = page.locator('.question').first();
  await expect(first).toBeVisible();
  if (await first.getByRole('button', { name: 'Show model answer' }).isVisible()) {
    await first.getByRole('button', { name: 'Show model answer' }).click();
    await first.getByRole('button', { name: 'Got it' }).click();
  } else {
    const options = await first.getByRole('radio').count();
    await first.getByRole('radio').first().check();
    await page.getByRole('button', { name: 'Check' }).click();
    await expect(first.locator('.why')).toHaveCount(options); // one explanation per option
  }
  await expect(first.getByRole('link', { name: /Review it in the card/ })).toBeVisible();
  await noAxeViolations(page);
});

test('timed exam can be paused and extended', async ({ page }) => {
  await page.goto('it/study/quiz/?mode=exam');
  await page.getByRole('button', { name: 'Inizia' }).click();
  const timer = page.getByRole('timer');
  await expect(timer).toBeVisible();
  const before = await timer.textContent();
  await page.getByRole('button', { name: 'Aggiungi 5 minuti' }).click();
  await expect(timer).not.toHaveText(before ?? '');
  await page.getByRole('button', { name: 'Pausa' }).click();
  await expect(page.getByText('In pausa', { exact: false })).toBeVisible();
  await expect(page.locator('.question')).toHaveCount(0);
});

test('export then re-import merges with an integrity check', async ({ page }) => {
  await page.goto('en/e/fixture-demo-b/');
  const bm = page.getByRole('button', { name: /Bookmark/ });
  await bm.click();
  await expect(bm).toHaveAttribute('aria-pressed', 'true');
  await page.goto('en/me/data/');
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export data' }).click()]);
  const path = await download.path();
  const file = JSON.parse(readFileSync(path, 'utf8'));
  expect(file).toMatchObject({ app: 'atlante-patologia', schemaVersion: 1 });
  await page.locator('input[type=file]').setInputFiles(path);
  await expect(page.getByText('Import complete: 0 items updated.')).toBeVisible();
  file.stores.bookmarks[0].updated += 1; // tampered
  await page.locator('input[type=file]').setInputFiles({ name: 'x.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(file)) });
  await expect(page.getByText(/integrity check failed/)).toBeVisible();
});

test('planner, chain and image training work on fixtures', async ({ page }) => {
  await page.goto('en/study/planner/');
  const exam = new Date(Date.now() + 40 * 86_400_000).toISOString().slice(0, 10);
  await page.getByLabel('Exam date').fill(exam);
  await page.getByRole('button', { name: 'Make the plan' }).click();
  await expect(page.getByText(/Last week: revision only/)).toBeVisible();

  await page.goto('en/study/chain/');
  await page.locator('fieldset').first().getByRole('radio').first().check();
  await expect(page.getByText('Which test confirms it?')).toBeVisible();

  await page.goto('en/study/images/');
  await page.getByRole('button', { name: 'Gross and micro pairs' }).click();
  await page.getByRole('button', { name: /Choice 1/ }).click();
  await expect(page.locator('.verdict')).toBeVisible();
  await page.getByRole('button', { name: 'Look-alikes' }).click();
  await expect(page.getByText('Which of the two diagnoses does this image show?')).toBeVisible();
});

test('evidence page cites the eight verified studies', async ({ page }) => {
  await page.goto('it/about/evidence/');
  await expect(page.locator('ol.refs > li')).toHaveCount(8);
  await expect(page.locator('main')).not.toContainText(/garantit|guarantee/);
});
