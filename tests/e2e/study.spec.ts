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
    const options = await first.locator('.options').getByRole('radio').count();
    await first.locator('.options').getByRole('radio').first().check();
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
  expect(file).toMatchObject({ app: 'atlante-patologia', schemaVersion: 2 });
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

test('WHO classification line and newer-edition notice render in both languages', async ({ page }) => {
  const foreign = guardRequests(page);
  await page.goto('it/e/fixture-demo/');
  const note = page.locator('.classification-note');
  await expect(note).toContainText(
    'Classificazione: WHO Classification of Tumours, 5ª ed., Vol. 1: Digestive System Tumours (2019) · verificata il 3 nov 2026',
  );
  await expect(note.locator('[data-newer-edition]')).toContainText('È disponibile un’edizione più recente: 6ª ed., a stampa, 2026.');
  await expect(note.locator('cite')).toHaveAttribute('lang', 'en');
  await noAxeViolations(page);

  await page.goto('en/e/fixture-demo/');
  await expect(page.locator('.classification-note')).toContainText('Classification: WHO Classification of Tumours, 5th ed., Vol. 1: Digestive System Tumours (2019) · checked on 3 Nov 2026');
  await expect(page.locator('[data-newer-edition]')).toContainText('A newer edition is available: 6th ed., in print, 2026.');
  // Cards without a classification block show nothing.
  await page.goto('en/e/fixture-demo-b/');
  await expect(page.locator('.classification-note')).toHaveCount(0);
  expect(foreign).toEqual([]);
});

test('evidence page cites the eight verified studies', async ({ page }) => {
  await page.goto('it/about/evidence/');
  await expect(page.locator('ol.refs > li')).toHaveCount(8);
  await expect(page.locator('main')).not.toContainText(/garantit|guarantee/);
});

// ── Metacognition: confidence, calibration, exam questions, oral simulator ──

/** Read one store of the learner DB. Only call after the app has opened it (a bare open would create an empty v1 DB). */
const readStore = (page: Page, store: string) =>
  page.evaluate(
    (s) =>
      new Promise<Record<string, unknown>[]>((resolve, reject) => {
        const req = indexedDB.open('atlas');
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
          const d = req.result;
          const all = d.transaction(s).objectStore(s).getAll();
          all.onsuccess = () => {
            resolve(all.result as Record<string, unknown>[]);
            d.close();
          };
          all.onerror = () => reject(all.error);
        };
      }),
    store,
  );

async function answerOral(page: Page, predicted: string, rubric: string) {
  await page.getByRole('button', { name: 'I have answered' }).click();
  await page.getByRole('group', { name: 'What score do you expect?' }).getByRole('radio', { name: predicted }).check();
  await page.getByRole('button', { name: 'Go to the check' }).click();
  await expect(page.getByText('Answer aloud, then check:')).toBeVisible();
  await expect(page.locator('.oral-focus a').first()).toHaveAttribute('target', '_blank');
  for (const c of ['Completeness', 'Accuracy', 'Structure', 'Terminology'])
    await page.getByRole('group', { name: new RegExp(`^${c}`) }).getByRole('radio', { name: rubric }).check();
}

test('confidence is asked before the answer in quiz, review and quick check, and feeds calibration in Me', async ({ page }) => {
  // Quick check: sure, then "I did not know it" → an overconfident topic.
  await page.goto('en/e/fixture-demo/');
  const qc = page.locator('.quick-check > li').first();
  await qc.getByRole('radio', { name: 'Sure', exact: true }).check();
  await qc.getByText('Show answer').click();
  await expect(qc.getByRole('radio', { name: 'Guessing' })).toBeDisabled(); // locked once the answer is open
  await qc.getByRole('button', { name: 'I did not know it' }).click();
  await expect(qc.getByRole('status')).toHaveText('Answer recorded.');

  // Quiz: the confidence is locked once the answer is checked.
  await page.goto('en/study/quiz/?mode=topic');
  await page.getByRole('spinbutton', { name: 'Number of questions' }).fill('1');
  await page.getByRole('button', { name: 'Start' }).click();
  const q = page.locator('.question').first();
  await q.getByRole('radio', { name: 'Fairly sure' }).check();
  if (await q.getByRole('button', { name: 'Show model answer' }).isVisible()) {
    await q.getByRole('button', { name: 'Show model answer' }).click();
    await q.getByRole('button', { name: 'Got it' }).click();
  } else {
    await q.locator('.options').getByRole('radio').first().check();
    await page.getByRole('button', { name: 'Check' }).click();
  }
  await expect(q.getByRole('radio', { name: 'Fairly sure' })).toBeDisabled();

  // Review: pick a confidence, reveal, rate.
  await page.goto('en/study/review/');
  await page.getByRole('radio', { name: 'Guessing' }).check();
  await page.getByRole('button', { name: /Show answer/ }).click();
  await page.keyboard.press('3');
  await expect(page.getByText('Card 2 of', { exact: false })).toBeVisible();

  const attempts = await readStore(page, 'quizAttempts');
  expect(attempts.map((a) => `${a.mode}:${a.confidence}`).sort()).toEqual(['quick:3', 'topic:2']);
  expect((await readStore(page, 'reviewLog')).map((l) => l.confidence)).toEqual([1]);

  await page.goto('en/me/');
  const calib = page.getByRole('region', { name: 'Confidence and results' });
  await expect(calib.locator('.calib-bars li')).toHaveCount(3);
  await expect(calib.getByText(/At least 10 answers/)).toBeVisible();
  await expect(page.getByRole('region', { name: 'Sure but wrong' }).getByRole('link', { name: 'Demo entry (placeholder)' })).toBeVisible();
  await noAxeViolations(page);
});

test('entity page lists possible exam questions that open onto the focus sections', async ({ page }) => {
  await page.goto('en/e/fixture-demo/');
  const block = page.getByRole('region', { name: 'Possible exam questions' });
  await expect(block.locator('summary')).toHaveCount(2);
  await block.locator('summary').first().click();
  await expect(block.getByText('Answer aloud, then check:').first()).toBeVisible();
  await expect(block.getByRole('link', { name: 'Definition and epidemiology' })).toHaveAttribute('href', '#definition');
  await expect(block.getByRole('link', { name: /oral exam simulator/ })).toBeVisible();
  await noAxeViolations(page);
});

test('oral simulator: three questions, prediction before self-assessment, calibration and history', async ({ page }) => {
  const foreign = guardRequests(page);
  await page.goto('en/study/oral/');
  await page.getByRole('checkbox', { name: 'Use a timer for each question' }).check();
  await page.getByRole('button', { name: 'Start' }).click();
  await expect(page.getByRole('heading', { name: 'Question 1 of 3' })).toBeFocused();
  await expect(page.getByRole('timer')).toContainText('Time left: 4:5');
  await noAxeViolations(page);
  await answerOral(page, '3 · good', '2 · partial');
  await expect(page.getByRole('button', { name: 'Save and continue' })).toBeEnabled();
  await noAxeViolations(page);
  await page.getByRole('button', { name: 'Save and continue' }).click();
  await expect(page.getByRole('heading', { name: 'Question 2 of 3' })).toBeFocused();
  await answerOral(page, '3 · good', '2 · partial');
  await page.getByRole('button', { name: 'Save and continue' }).click();
  await answerOral(page, '4 · excellent', '3 · good');
  await page.getByRole('button', { name: 'Finish' }).click();

  await expect(page.getByRole('heading', { name: 'Session complete' })).toBeFocused();
  await expect(page.locator('.oral-results tbody tr')).toHaveCount(3);
  await expect(page.getByText(/Mean predicted 3\.3 · mean self-assessed 2\.3/)).toBeVisible();
  await expect(page.getByText(/you predict more than you then award yourself/)).toBeVisible();
  // Focusing the heading scrolls the breadcrumb under the sticky header, which axe reads as a small target.
  await page.evaluate(() => window.scrollTo(0, 0));
  await noAxeViolations(page);
  const [session] = await readStore(page, 'oralSessions');
  expect((session!.items as unknown[]).length).toBe(3);

  await page.getByRole('button', { name: 'Start again' }).click();
  await expect(page.getByRole('region', { name: 'Previous sessions' }).getByText(/3 questions, self-assessed 2\.3 out of 4/)).toBeVisible();
  expect(foreign).toEqual([]);
});

test('export and import carry confidence and oral sessions into a fresh browser', async ({ page, browser }, info) => {
  await page.goto('en/e/fixture-demo-b/');
  const qc = page.locator('.quick-check > li').first();
  await qc.getByRole('radio', { name: 'Guessing' }).check();
  await qc.getByText('Show answer').click();
  await qc.getByRole('button', { name: 'I knew it' }).click();
  await expect(qc.getByRole('status')).toHaveText('Answer recorded.');
  // One oral question is saved even if the session is left unfinished.
  await page.goto('en/study/oral/');
  await page.getByRole('button', { name: 'Start' }).click();
  await answerOral(page, '2 · partial', '4 · excellent');
  await page.getByRole('button', { name: 'Save and continue' }).click();
  await expect(page.getByRole('heading', { name: 'Question 2 of 3' })).toBeVisible();

  await page.goto('en/me/data/');
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export data' }).click()]);
  const path = await download.path();
  const file = JSON.parse(readFileSync(path, 'utf8'));
  expect(file.schemaVersion).toBe(2);
  expect(file.stores.oralSessions[0].items[0]).toMatchObject({ predicted: 2, rubric: { completeness: 4, accuracy: 4, structure: 4, terminology: 4 } });
  expect(file.stores.quizAttempts[0]).toMatchObject({ mode: 'quick', confidence: 1, correct: true });

  const fresh = await browser.newContext({ baseURL: info.project.use.baseURL });
  const other = await fresh.newPage();
  await other.goto('en/me/data/');
  await other.locator('input[type=file]').setInputFiles(path);
  await expect(other.getByText(/Import complete: [1-9]\d* items updated\./)).toBeVisible();
  expect((await readStore(other, 'oralSessions'))[0]).toMatchObject({ items: [{ predicted: 2 }] });
  expect((await readStore(other, 'quizAttempts'))[0]).toMatchObject({ confidence: 1 });
  await other.goto('en/study/oral/');
  await expect(other.getByText(/1 questions, self-assessed 4 out of 4/)).toBeVisible();
  await fresh.close();
});

test('upgrading a version-1 learner database keeps every record and adds the oral store', async ({ page }) => {
  // A same-origin blank page: nothing of the app opens the DB before the v1 copy exists.
  await page.route('**/__blank__', (r) => r.fulfill({ contentType: 'text/html', body: '<!doctype html><title>blank</title>' }));
  await page.goto('__blank__');
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const v1 = ['cards', 'reviewLog', 'bookmarks', 'notes', 'highlights', 'errors', 'readProgress', 'recent', 'quizAttempts', 'plan', 'settings'];
        const req = indexedDB.open('atlas', 1);
        req.onupgradeneeded = () => {
          for (const s of v1) req.result.createObjectStore(s, { keyPath: 'id' });
          const tx = req.transaction!;
          tx.objectStore('bookmarks').put({ id: 'fixture-demo', updated: 1 });
          tx.objectStore('notes').put({ id: 'fixture-demo', text: 'v1 note', updated: 1 });
          tx.objectStore('quizAttempts').put({ id: 'q@1', question: 'q', entities: ['fixture-demo'], module: 'g01', correct: false, mode: 'topic', at: 1, updated: 1 });
        };
        req.onsuccess = () => {
          req.result.close();
          resolve();
        };
        req.onerror = () => reject(req.error);
      }),
  );
  await page.goto('en/me/');
  await expect(page.getByRole('region', { name: 'Confidence and results' })).toBeVisible();
  const version = await page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        const req = indexedDB.open('atlas');
        req.onsuccess = () => {
          resolve(req.result.version);
          req.result.close();
        };
      }),
  );
  expect(version).toBe(2);
  expect(await readStore(page, 'bookmarks')).toEqual([{ id: 'fixture-demo', updated: 1 }]);
  expect(await readStore(page, 'notes')).toEqual([{ id: 'fixture-demo', text: 'v1 note', updated: 1 }]);
  expect(await readStore(page, 'quizAttempts')).toHaveLength(1);
  expect(await readStore(page, 'oralSessions')).toEqual([]);
});
