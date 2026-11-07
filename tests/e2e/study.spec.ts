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

/** Open the data page and wait for its island: the server-rendered buttons ignore a click made before hydration (Astro then drops `ssr`). */
async function openData(page: Page) {
  await page.goto('en/me/data/');
  await expect(page.locator('astro-island[component-url*="DataManager"][ssr]')).toHaveCount(0);
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
  await openData(page);
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
  // Two activations in one task (fast double press): one record, one pressed button.
  await qc.evaluate((li) => {
    const [knew, missed] = li.querySelectorAll<HTMLButtonElement>('button[data-grade]');
    missed!.click();
    knew!.click();
  });
  await expect(qc.getByRole('status')).toHaveText('Answer recorded.');
  await expect(qc.locator('button[data-grade][aria-pressed="true"]')).toHaveCount(1);
  await expect(qc.getByRole('button', { name: 'I did not know it' })).toHaveAttribute('aria-pressed', 'true');

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
  // The attempt is written after the feedback shows: leaving the page sooner would abort the write.
  await expect.poll(async () => (await readStore(page, 'quizAttempts')).length).toBe(2);

  // Review: pick a confidence, reveal, rate.
  await page.goto('en/study/review/');
  await page.getByRole('radio', { name: 'Guessing' }).check();
  await page.getByRole('button', { name: /Show answer/ }).click();
  // The key handler is re-bound after the reveal renders; the answer taking focus marks that point.
  await expect(page.locator('.answer')).toBeFocused();
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
  const timer = page.getByRole('checkbox', { name: 'Use a timer for each question' });
  // The box sits beside its label, in regular weight (a tool-form label is otherwise a bold grid).
  expect(await timer.evaluate((i) => [getComputedStyle(i.parentElement!).display, getComputedStyle(i.parentElement!).fontWeight])).toEqual(['flex', '400']);
  await timer.check();
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

  // Record every text the history shows after "Start again": it must never claim that nothing is saved, not even for one frame.
  await page.evaluate(() => {
    const w = window as unknown as { historyTexts: string[] };
    w.historyTexts = [];
    new MutationObserver(() => {
      const h = document.querySelector('[aria-labelledby="oral-history-title"]');
      if (h) w.historyTexts.push(h.textContent ?? '');
    }).observe(document.body, { subtree: true, childList: true, characterData: true });
  });
  await page.getByRole('button', { name: 'Start again' }).press('Enter'); // keyboard, as in the review finding
  // Focus goes to the first setup control, never to <body> (WCAG 2.4.3).
  await expect(page.getByRole('checkbox', { name: 'Use a timer for each question' })).toBeFocused();
  // The list stays folded behind one line (no shift when it loads) until the learner opens it.
  const history = page.getByRole('region', { name: 'Previous sessions' });
  await history.getByText('Saved sessions: 1').click();
  await expect(history.getByText(/3 questions, self-assessed 2\.3 out of 4/)).toBeVisible();
  const texts = await page.evaluate(() => (window as unknown as { historyTexts: string[] }).historyTexts);
  expect(texts.length).toBeGreaterThan(0);
  expect(texts.filter((s) => s.includes('No sessions saved'))).toEqual([]);
  // The page stays scrolled after the results: the focused setup control must not end up under the sticky bar.
  await noAxeViolations(page);
  expect(foreign).toEqual([]);
});

/** Write records into one store of the learner DB (the app must have opened it first, see readStore). */
const writeStore = (page: Page, store: string, records: object[]) =>
  page.evaluate(
    ([s, recs]) =>
      new Promise<void>((resolve, reject) => {
        const req = indexedDB.open('atlas');
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
          const d = req.result;
          const tx = d.transaction(s, 'readwrite');
          for (const r of recs) tx.objectStore(s).put(r);
          tx.oncomplete = () => {
            d.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
    [store, records] as const,
  );

test('oral history: a damaged session is listed and can be deleted without touching anything else', async ({ page }) => {
  await page.goto('en/study/oral/');
  const history = page.getByRole('region', { name: 'Previous sessions' });
  await expect(history).toContainText('No sessions saved on this device.');
  const rubric = { completeness: 3, accuracy: 3, structure: 3, terminology: 3 };
  const good = { id: 'oral@2', at: Date.UTC(2026, 10, 2), updated: 2, items: [{ question: 'fixture-demo#1', entity: 'fixture-demo', text: 'Q?', predicted: 4, rubric, seconds: 30 }] };
  // Written by an older build or by hand: no rubric, so the simulator cannot read it.
  const damaged = { id: 'oral@1', at: Date.UTC(2026, 10, 1), updated: 1, items: [{ question: 'fixture-demo#2', entity: 'fixture-demo', text: 'Q?', predicted: 3 }] };
  await writeStore(page, 'oralSessions', [good, damaged]);
  await writeStore(page, 'notes', [{ id: 'fixture-demo', text: 'my note', updated: 1 }]);
  await page.reload();

  await history.getByText('Saved sessions: 2').click();
  await expect(history.getByRole('listitem')).toHaveCount(2);
  await expect(history.getByRole('listitem').first()).toContainText('Damaged session, cannot be read');
  await expect(history).toContainText('2 Nov 2026: 1 questions, self-assessed 3 out of 4');
  await expect(history).toContainText('Mean predicted 4 · mean self-assessed 3 (out of 4, 1 questions)');
  await noAxeViolations(page);

  await history.getByRole('button', { name: 'Delete: Damaged session, cannot be read' }).click();
  await expect(page.getByRole('heading', { name: 'Previous sessions' })).toBeFocused();
  await expect(history.getByRole('listitem')).toHaveCount(1);
  const rows = await readStore(page, 'oralSessions');
  expect(rows.find((r) => r.id === 'oral@1')).toMatchObject({ deleted: true }); // a tombstone: an older backup cannot bring it back
  expect(rows.find((r) => r.id === 'oral@2')).toEqual(good);
  expect(await readStore(page, 'notes')).toEqual([{ id: 'fixture-demo', text: 'my note', updated: 1 }]);

  await history.getByRole('button', { name: /^Delete: 2 Nov 2026/ }).click();
  await expect(history).toContainText('No sessions saved on this device.');
  await expect(history).not.toContainText('Mean predicted');
});

test('exam mode: pressing Finish again while the answers are being saved stores each answer once', async ({ context }) => {
  // An older tab holds the database open, so the writes wait (as on a slow phone): the second press lands while they are pending.
  const old = await context.newPage();
  await holdOpen(old, 1);
  const page = await context.newPage();
  await page.goto('en/study/quiz/?mode=exam');
  await page.getByRole('spinbutton', { name: 'Number of questions' }).fill('3');
  await page.getByRole('button', { name: 'Start' }).click();
  let answered = 0;
  for (let i = 0; i < 3; i++) {
    const options = page.locator('.question .options').getByRole('radio');
    await expect(page.getByRole('heading', { name: `Question ${i + 1} of 3` })).toBeVisible();
    if ((await options.count()) > 0) {
      await options.first().check();
      answered++;
    }
    if (i < 2) await page.getByRole('button', { name: 'Next' }).click();
  }
  expect(answered).toBeGreaterThan(0); // the fixtures hold one free-text question at most, so two or three get options
  const finish = page.getByRole('button', { name: 'Finish' });
  await finish.click();
  await finish.click(); // still shown: the first press is waiting for the database
  await old.close();
  await expect(page.getByRole('heading', { name: 'Results' })).toBeVisible();
  await page.waitForTimeout(300); // let any second round of writes land before counting
  const attempts = await readStore(page, 'quizAttempts');
  expect(attempts).toHaveLength(answered);
  expect(new Set(attempts.map((a) => a.question)).size).toBe(answered);

  // "Start again" removes the results: focus goes to the chosen mode, never to <body> (WCAG 2.4.3).
  await page.getByRole('button', { name: 'Start again' }).press('Enter');
  await expect(page.getByRole('radio', { name: /^Timed exam/ })).toBeFocused();
  await expect(page.getByRole('radio', { name: /^Timed exam/ })).toBeChecked();
  await noAxeViolations(page); // the focused control is not left under the sticky bar
});

test('oral simulator: "time is up" is announced in a live region, and a double save stores one answer', async ({ page }) => {
  await page.clock.install();
  await page.goto('en/study/oral/');
  await page.getByRole('checkbox', { name: 'Use a timer for each question' }).check();
  await page.getByRole('spinbutton').fill('1');
  await page.getByRole('button', { name: 'Start' }).click();
  const status = page.locator('.oral').getByRole('status');
  await expect(status).toHaveText('');
  await page.clock.runFor(61_000);
  await expect(status).toHaveText('Time is up: wrap up your answer.');
  await expect(status).toHaveClass(/notice/);

  await answerOral(page, '3 · good', '2 · partial');
  await page.getByRole('button', { name: 'Save and continue' }).dblclick();
  await expect(page.getByRole('heading', { name: 'Question 2 of 3' })).toBeFocused();
  const [session] = await readStore(page, 'oralSessions');
  expect((session!.items as unknown[]).length).toBe(1);
});

test('a malformed oral session in an import file is rejected', async ({ page }) => {
  await openData(page);
  const stores = { oralSessions: [{ id: 'oral@1', at: 1, updated: 1, items: [{ question: 'a#1', entity: 'a', text: '?', predicted: 3 }] }] };
  const file = await page.evaluate(async (st) => {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(st)));
    const checksum = [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
    return JSON.stringify({ app: 'atlante-patologia', schemaVersion: 2, exportedAt: '2026-01-01T00:00:00Z', checksum, stores: st });
  }, stores);
  await page.locator('input[type=file]').setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from(file) });
  await expect(page.getByText('The file is not a valid atlas backup.')).toBeVisible();
  expect(await readStore(page, 'oralSessions')).toEqual([]);
  await page.goto('en/study/oral/');
  await expect(page.getByRole('button', { name: 'Start' })).toBeVisible();
});

test('the oral history moves nothing on the page for a returning learner (CPU 4× slower, footer in view)', async ({ page }) => {
  await page.goto('en/study/oral/');
  await expect(page.getByRole('region', { name: 'Previous sessions' })).toContainText('No sessions saved on this device.');
  const rubric = { completeness: 3, accuracy: 3, structure: 3, terminology: 3 };
  const item = { question: 'fixture-demo#1', entity: 'fixture-demo', text: 'Q?', predicted: 3, rubric, seconds: 30 };
  await writeStore(page, 'oralSessions', [1, 2, 3].map((n) => ({ id: `oral@${n}`, at: Date.UTC(2026, 10, n), updated: n, items: [item, item, item] })));
  // Sized so the footer is in view: anything that grows after paint would push it down and count.
  const footer = await page.locator('.site-footer').evaluate((f) => f.getBoundingClientRect().top + scrollY);
  await page.setViewportSize({ width: 1280, height: Math.ceil(footer) + 40 });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await page.addInitScript(() => {
    const w = window as unknown as { __cls: number };
    w.__cls = 0;
    new PerformanceObserver((list) => {
      for (const e of list.getEntries() as (PerformanceEntry & { value: number; hadRecentInput: boolean })[]) if (!e.hadRecentInput) w.__cls += e.value;
    }).observe({ type: 'layout-shift', buffered: true });
  });
  await page.goto('en/study/oral/');
  const history = page.getByRole('region', { name: 'Previous sessions' });
  await expect(history.getByText('Saved sessions: 3')).toBeVisible();
  await page.waitForTimeout(1000);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  expect(await page.evaluate(() => (window as unknown as { __cls: number }).__cls)).toBe(0);
  // Opened on request, the list and the verdict are all there.
  await history.getByText('Saved sessions: 3').click();
  await expect(history.getByRole('listitem')).toHaveCount(3);
  await expect(history).toContainText('Mean predicted 3 · mean self-assessed 3 (out of 4, 9 questions)');
});

test('an answer time stays positive when the wall clock steps back during the answer', async ({ page }) => {
  await page.clock.install();
  await page.goto('en/study/oral/');
  await page.getByRole('button', { name: 'Start' }).click();
  await page.clock.runFor(5_000);
  // The device clock is corrected backwards (network time): Date jumps, performance.now() does not.
  await page.clock.setSystemTime(Date.now() - 60_000);
  await answerOral(page, '3 · good', '3 · good');
  await page.getByRole('button', { name: 'Save and continue' }).click();
  await expect(page.getByRole('heading', { name: 'Question 2 of 3' })).toBeFocused();
  const [session] = await readStore(page, 'oralSessions');
  const [item] = session!.items as { seconds: number }[];
  expect(item!.seconds).toBeGreaterThanOrEqual(0);
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

  await openData(page);
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export data' }).click()]);
  const path = await download.path();
  const file = JSON.parse(readFileSync(path, 'utf8'));
  expect(file.schemaVersion).toBe(2);
  expect(file.stores.oralSessions[0].items[0]).toMatchObject({ predicted: 2, rubric: { completeness: 4, accuracy: 4, structure: 4, terminology: 4 } });
  expect(file.stores.quizAttempts[0]).toMatchObject({ mode: 'quick', confidence: 1, correct: true });

  const fresh = await browser.newContext({ baseURL: info.project.use.baseURL });
  const other = await fresh.newPage();
  await openData(other);
  await other.locator('input[type=file]').setInputFiles(path);
  await expect(other.getByText(/Import complete: [1-9]\d* items updated\./)).toBeVisible();
  expect((await readStore(other, 'oralSessions'))[0]).toMatchObject({ items: [{ predicted: 2 }] });
  expect((await readStore(other, 'quizAttempts'))[0]).toMatchObject({ confidence: 1 });
  await other.goto('en/study/oral/');
  await other.getByText('Saved sessions: 1').click();
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

/** Opens the learner DB at `version` in a same-origin blank page and keeps the connection open (like a tab running old code). */
async function holdOpen(page: Page, version: number) {
  await page.route('**/__blank__', (r) => r.fulfill({ contentType: 'text/html', body: '<!doctype html><title>blank</title>' }));
  await page.goto('__blank__');
  await page.evaluate(
    (v) =>
      new Promise<void>((resolve, reject) => {
        const req = indexedDB.open('atlas', v);
        req.onupgradeneeded = () => {
          if (req.result.objectStoreNames.length) return; // an upgrade of the app's own DB: add nothing
          for (const s of ['cards', 'reviewLog', 'bookmarks', 'notes', 'highlights', 'errors', 'readProgress', 'recent', 'quizAttempts', 'plan', 'settings'])
            req.result.createObjectStore(s, { keyPath: 'id' });
          req.transaction!.objectStore('notes').put({ id: 'fixture-demo', text: 'v1 note', updated: 1 });
        };
        // Old code never closes on versionchange: keep the connection referenced and open.
        req.onsuccess = () => {
          (window as unknown as { held: IDBDatabase }).held = req.result;
          resolve();
        };
        req.onerror = () => reject(req.error);
      }),
    version,
  );
}

test('an older tab that keeps the database open blocks the upgrade with a notice, and nothing is lost', async ({ context }) => {
  const old = await context.newPage();
  await holdOpen(old, 1);
  const page = await context.newPage();
  await page.goto('en/study/oral/');
  const history = page.getByRole('region', { name: 'Previous sessions' });
  await expect(page.getByText('Close the other atlas tabs to finish the update.', { exact: false })).toBeVisible();
  // Reloading this tab cannot end the wait: no Reload here, only Close.
  await expect(page.locator('[data-db-reload]')).toBeHidden();
  await expect(page.locator('[data-db-box]').getByRole('button', { name: 'Close' })).toBeVisible();
  await expect(history).toContainText('Loading…');
  await old.close();
  await expect(page.getByText('Close the other atlas tabs to finish the update.', { exact: false })).toBeHidden();
  await expect(history).toContainText('No sessions saved on this device.');
  expect(await readStore(page, 'notes')).toEqual([{ id: 'fixture-demo', text: 'v1 note', updated: 1 }]);
  expect(await readStore(page, 'oralSessions')).toEqual([]);
});

test('code older than the learner database shows the storage notice, never "No sessions saved"', async ({ context }) => {
  // A newer build has already upgraded the database (as after a rollback): this build's open fails with a VersionError.
  const newer = await context.newPage();
  await holdOpen(newer, 99);
  await newer.close();
  const page = await context.newPage();
  await page.goto('en/study/oral/');
  const history = page.getByRole('region', { name: 'Previous sessions' });
  await expect(history).toContainText('Your browser does not allow saving data');
  await expect(history).not.toContainText('No sessions saved');
  await expect(page.getByRole('button', { name: 'Start' })).toBeVisible(); // the simulator itself still works
});

test('a newer version in another tab is never blocked by this one, which offers a reload', async ({ context }) => {
  const page = await context.newPage();
  await page.goto('en/study/oral/');
  await expect(page.getByRole('region', { name: 'Previous sessions' })).toContainText('No sessions saved on this device.');
  const next = await context.newPage();
  // Resolves only if this tab closes its connection (no `blocked` wait).
  await holdOpen(next, 99);
  await expect(page.getByText('A newer version of the atlas is open in another tab.', { exact: false })).toBeVisible();
  await expect(page.locator('[data-db-reload]')).toBeVisible();
});

test('every tab that waits behind a blocked upgrade shows the notice, and each continues once the old tab closes', async ({ context }) => {
  // Only the request at the head of the browser's queue gets a `blocked` event; the others wait silently.
  const old = await context.newPage();
  await holdOpen(old, 1);
  const review = await context.newPage();
  await review.goto('en/study/review/');
  const card = await context.newPage();
  await card.goto('en/e/fixture-demo/');
  for (const p of [review, card]) await expect(p.getByText('Close the other atlas tabs to finish the update.', { exact: false })).toBeVisible();
  await old.close();
  for (const p of [review, card]) await expect(p.locator('[data-db-box]')).toBeHidden();
  await expect(review.getByText(/0 due · [1-9]\d* new/)).toBeVisible();
  const bm = card.getByRole('button', { name: /Bookmark/ });
  await bm.click();
  await expect(bm).toHaveAttribute('aria-pressed', 'true');
  expect(await readStore(card, 'bookmarks')).toMatchObject([{ id: 'fixture-demo' }]);
  expect(await readStore(card, 'notes')).toEqual([{ id: 'fixture-demo', text: 'v1 note', updated: 1 }]);
});

test('with a new version waiting, the database notice points to its Reload and never covers it', async ({ page }) => {
  await page.goto('en/');
  // As in a deploy: the update notice is up, then this tab's upgrade waits for an older tab.
  await page.evaluate(() => {
    document.querySelector<HTMLElement>('[data-update-notice]')!.hidden = false;
    window.dispatchEvent(new CustomEvent('ap:db-state', { detail: 'blocked' }));
  });
  const box = page.locator('[data-db-box]');
  await expect(box).toContainText('press “Reload” in the new-version notice');
  await expect(page.locator('[data-db-reload]')).toBeHidden();
  const reload = page.locator('[data-update-reload]');
  const hit = await reload.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return el.contains(document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2));
  });
  expect(hit).toBe(true);
  // Escape (or Close) dismisses the database notice; the update notice stays.
  await page.keyboard.press('Escape');
  await expect(box).toBeHidden();
  await expect(reload).toBeVisible();
});
