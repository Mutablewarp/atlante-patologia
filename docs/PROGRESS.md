# Progress

## PHASE 0 — Discovery (2026-10-10) — complete, waiting at CHECKPOINT 1

| Step | Evidence (commands actually run) | Result |
|---|---|---|
| Containment before anything else | `.gitignore` written first; `reference/rubin.pdf` is a symlink (`ls -la reference`) | `/reference/`, `/.work/`, `*.pdf/*.epub/*.docx` ignored; no git repo yet, so no commit was possible |
| Reference intake | PyMuPDF via `uv run --with pymupdf python -I` on all pages | 1,671 PDF pages; 8th ed., © 2020 Wolters Kluwer; 651-entry outline; 34 chapters |
| Full-text extraction | Same script, all pages → `.work/fulltext.txt`, `.work/lines.jsonl` | 977,036 words; 154,420 styled lines (gitignored) |
| Structure analysis | Font-style profiling → heading tree `.work/headings.tsv` | 4,080 headings; 817 labelled disease-entity sections; printed page = PDF − 24 (1,198/1,198 pages agree) |
| External facts | Sub-agent: `npm view`, GitHub releases API, Crossref API, official docs; follow-up `npm view` checks | [VERIFIED_FACTS.md](VERIFIED_FACTS.md) sections A–M; 8/8 DOIs match; 4 toolchain conflicts found |
| Docs written | — | SYLLABUS_MAP, SOURCES, ARCHITECTURE, CONTENT_SCHEMA, NAVIGATION_SPEC, COMPLIANCE_PLAN, RISKS, DECISIONS, VERIFIED_FACTS, PROGRESS |
| No-verbatim self-check of all docs | Ad-hoc n-gram script (12-gram any-hit, 8-gram > 1%) against the full reference text | 12/12 files: 0.00% 8-gram overlap, 0 shared 12-grams. Positive control (30-word reference excerpt): FAIL as expected (exit 1) |

Not done in Phase 0 (by design):
- No code, no git init, no commits, no deployment.
- Italian terminology is proposed, not verified: no Italian reference was supplied.

## PHASE 1 — Foundation — complete

| Step | Evidence | Result |
|---|---|---|
| Site spine | commits `364025b`, `f199a94` | Astro 7 static site, Preact islands, IT/EN routing, design system, content schema (`src/lib/schema.ts`), containment guard + no-verbatim pre-commit hook |
| Quality layer (`feat/quality-e2e`, merged `87b84fc`) | `npm run test:dist`, `npx playwright test`, `npm run lighthouse`, CI workflow | dist validators (navigation graph, links, budgets), Playwright 3 engines × 5 widths, Lighthouse mobile ≥ 90, license ledger |
| Content gates (`feat/content-gates`, merged `6985202`) | `npm run test:content`; `tests/content/fixtures.test.ts` mutates a valid synthetic tree once per failure case | schema, parity, ledger, numbers, references, review, images gates on the real tree; `REVIEWERS` file |

## PHASE 2 — Learning layer and first module — on `main`, deployed 2026-11-03

Merged in this order with `git merge --no-ff`: `feat/content-gates`, `feat/quality-e2e`, `feat/horizontal-tools` (`db476ef`), `feat/study-engine` (`87c8eac`), `feat/pwa-offline` (`e06dfd7`), `content/g01` (`0922e08`), then integration fixes up to `cb8394f`.

| Area | What is on `main` | Evidence |
|---|---|---|
| Horizontal tools | `[[id]]`/`[[g:id]]` cross-links (D038), compare, differential, concept map, learning paths, pattern pages, image viewer, command palette (H01–H07) | `tests/horizontal.test.ts`; dist + Playwright suites |
| Study engine | FSRS review, cloze/QA/occlusion cards, quizzes and timed exam, planner, chain and image training, IndexedDB with export/import checksum (D039–D048) | `tests/study.test.ts`; `npm run test:e2e:study` 7/7 passed (Chromium, fixture build) |
| Offline | service worker precaches the shell (both home pages, `/offline/`, `/me/offline/`, CSS/JS, fonts, icons); opt-in offline packs per published module | build log `sw-manifest: shell 56 files, 2 offline pack(s)`; `npm run test:e2e:offline` 4/4 passed (Chromium + WebKit) |
| Module g01 | 26 published entity cards (all `ai-generated-unreviewed`), 1 pattern page, 38 questions, 34 glossary terms, 81 images, 2 learning paths, 27 claim ledgers | `npm test` content gates green; `NO_VERBATIM_WORK=.work node scripts/no-verbatim.mjs` → 297 files, 0 failed |

Final verification on `main` (2026-11-03):

| Command | Result |
|---|---|
| `npm run check` | 0 errors, 0 warnings, 0 hints |
| `npm test` | 99 passed, 2 skipped (the per-entity view runs only with `ENTITY=<id>`) |
| `npm run build` | 315 pages, no warnings; Pagefind index; 2 offline packs (it, en) |
| `npm run test:dist` | 12/12 passed |
| `E2E_ENGINES=chromium,webkit npx playwright test` | 434 passed, 86 skipped by design (width-scoped tests) |
| `npm run test:e2e:study` / `npm run test:e2e:offline` | 7/7 and 4/4 passed |
| `npm run lighthouse` (+ `/it/e/coagulative-necrosis/`, `/en/pattern/p01-necrosis/`, `/it/atlas/process/necrosis/`) | all ≥ 92 performance, 100 accessibility, best practices, SEO |

Integration fixes (each its own commit or recorded in the merge commit):

- Shared fixture `_fixture-demo-b` merged from the horizontal and study versions; study question and image fixtures renamed with a leading `_` (H04), and the gates treat `_` questions/images as fixtures.
- `study.ts` asset glob excludes `_` files, so `_fixture-grid.png` never reaches production `dist/`.
- `<ap-path-progress entities>` splits on `/[\s,]+/` (`parseIdList`, unit-tested), reconciling H07 (space) and D045 (comma).
- Playwright: the main config serves `dist/` and ignores the two fixture-build specs; `tests/e2e/offline.config.ts` and `tests/e2e/study.config.ts` build their own fixture sites. CI runs both.
- The per-entity validator from `content/g01` duplicated the gates; it is now a thin per-entity filter over `runGates` (`npm run validate:entity -- <id>`). Its unique checks moved into the gates: `[[id]]`/`[[g:id]]` targets, Differential table, High-yield bold bullets.
- Numbers gate: a genus abbreviation (*C. novyi*) no longer ends a sentence; the coagulative-necrosis timeline time cells carry their existing claim markers (no new facts).
- Atlas page lists lens terms inline as links, so every entity is 3 steps from Home through a lens (the dist test found 4 once g01 was published).
- A–Z links have a 24 px minimum width (WCAG 2.5.8; the alias "Ub" was 21 px).
- Offline copy now says "the home page" (what the shell actually precaches) instead of "the main pages"; README updated.
- Docs: COMPLIANCE_PLAN states self-hosted OFL fonts (D015); CONTENT_SCHEMA and D038 agree that `[[id]]` links are resolved at build.

Deploy (2026-11-03). The first CI run on `main` (`b04bca7`) failed in two jobs, so nothing was deployed. Three fixes followed, each confirmed by CI on Linux:

- Firefox keyboard test: Firefox keeps `document.activeElement` on the last link when focus leaves the page, so the tab walk counted "Crediti" as a backwards stop 59 times. The walk now ends there in Firefox only; in other engines focus that does not move is reported as a keyboard trap (`1d49a89`, `34af550`).
- Layout shift: on the slower Linux runner the wider fallback font re-wrapped the disclaimer buttons when the web font swapped in (CLS 0.188, Lighthouse performance 89 on `/en/atlas/`). D049: `font-display: optional` and preload for the two latin upright files, `swap` kept for italic and latin-ext (`00a78c4`, `7cdb0ed`). Result: CLS 0 on eight pages with a Linux-like fallback, Lighthouse 99.
- Service worker: Linux WebKit reported the first worker as `controller` before its `installed` event, so a first visit showed the update notice and reloaded itself. The update check now uses whether the page was controlled when it loaded; a new offline e2e test covers it (`5080c19`).

CI run 41693234505 on `5080c19`: test, e2e (Chromium, Firefox, WebKit), Lighthouse and deploy succeeded. Live smoke test (Playwright, Chromium and WebKit, 390 px wide): home, search, entity page with AI badge and disclaimer, pattern table, quiz answer with feedback, review, service worker control and offline fallback all worked, with 0 console errors and 0 HTTP errors.

Open (not done in this pass):

- Every g01 card is `ai-generated-unreviewed`; [REVIEW_QUEUE.md](REVIEW_QUEUE.md) lists the open expert decisions.
- Firefox runs only in CI (smoke subset); it is not installed locally (the browser download needs the owner's approval).
- Keyboard test gaps found in review, not fixed: the `en/atlas/` walk stops at `MAX_STOPS` (80) before the footer; the `seen` check never fires (its id includes the stop index); an off-screen element is reported as "hidden behind sticky bars", never as "off screen".
- No screen-reader pass and no real iOS/Android device test of offline packs.
- Gates do not check that a commit author is in `REVIEWERS` (CONTENT_SCHEMA §1a); `no-verbatim --staged` reads the working-tree copy, not the staged blob.

## V2.1 — Reading and study layer — merged on `main` 2026-11-04 (not pushed)

Merged with `git merge --no-ff` in this order: `v2/who-watch` (`420c5af`), `v2/image-viewer` (`7074475`), `v2/study-metacognition` (`1e36f5c`), `v2/3d-pathways` (`b272493`), `v2/reading-ux` (`bbf688f`).

| Branch | What is on `main` |
|---|---|
| who-watch | WHO volumes in `sources.yaml` with series, edition, status and `supersedes`; `classification` block on entities with a newer-edition notice; weekly `who-watch.yml` + `scripts/who-watch.mjs` that open review issues; reviewed baseline of 2026-11-03; `docs/WHO_WATCH.md` |
| image-viewer | image `group`, `objective`, `mpp`, `section`, `orientation`, `lookFor`; pan buttons (WCAG 2.5.7), keyboard zoom, full screen dialog, sharper zoom via srcset, stain/section switch, scale bar only with `mpp` |
| study-metacognition | learner DB v2 (adds stores only, v1 upgrade tested); confidence before the answer in quick check, quiz and review; calibration in Me; optional `examQuestions`; oral simulator; export schema 2 that still imports v1 files |
| 3d-pathways | intrinsic apoptosis pathway page, 3Dmol 2.5.5 loaded on demand (D050), six CC0 PDB structures (1F16, 1NW9, 1PAU, 3JBT, 3ZCF, 6O0K) with provenance and posters; the 3Dmol chunk and `/structures/*` stay out of the precache (dist test) |
| reading-ux | fluid type, warm paper and soft graphite themes, A-/A+ text size, reading progress, study callouts, Continue links, no per-page AI badge, AI-assistance line in every footer and a rewritten Method page (O11) |

Conflicts, all resolved by keeping both sides: `sources.yaml` (WHO volumes + PDB citations), entity page imports (ExamQuestions + EntityPathways), study hub (oral card + pathway cards), `EntityHeader.astro` (ClassificationNote + TextSize). `package-lock.json` changed with 3dmol, so `npm ci` ran after that merge.

Integration fixes:

- `ccbd560` fix(a11y): the quick-check confidence radios were 20 × 20 px, so the target-size test failed on every entity page (10 of 10 projects). Radios and checkboxes are now `max(1.5rem, 24px)`.
- `3ecba3f` test(e2e): the confidence test pressed "3" before the review key handler had re-bound after the reveal (2 of 6 runs failed). It now waits for the answer to take focus; 24 of 24 runs passed.

Verification on `main` after the fixes:

| Command | Result |
|---|---|
| `npm run guard` | ok (691 checked files) |
| `npm run check` | 0 errors, 0 warnings, 0 hints (199 files) |
| `npm test` | 190 passed, 2 skipped |
| `npm run build` | 320 pages; Pagefind 286 pages; `sw-manifest: shell 60 files, 2 offline pack(s)`; Vite chunk-size and `[EVAL]` warnings from the lazy 3Dmol chunk |
| `npm run test:dist` | 15/15 passed |
| `npm run contrast` | all 86 pairs pass |
| `npm run licenses` | 570 packages, 9 documented exceptions |
| `E2E_ENGINES=chromium,webkit npx playwright test --workers=4` | 580 passed, 120 skipped by design |
| `npm run test:e2e:study` / `npm run test:e2e:offline` | 18/18 and 6/6 passed |
| `npm run lighthouse` | `/it/`, `/en/atlas/`, `/it/about/`: performance 99, 100 in the other three |
| `node scripts/lighthouse-assert.mjs` on 7 v2 pages | performance 91 (`/it/e/apoptosis/`) to 97 (pathway, oral, study hub); 100 accessibility, best practices, SEO; no CLS loss reported |
| `NO_VERBATIM_WORK=…/.work node scripts/no-verbatim.mjs` | 306 files, 0 failed |
| public-naming grep (teacher surnames, channel names, course and sheet codes) over tracked files, `dist/` and the new commit messages | 0 hits |

Open after V2.1:

- Not pushed: CI, deploy and the live smoke test have not run on these commits. The WHO watch workflow has never run on GitHub (`gh workflow run who-watch.yml` once after the push confirms labels and issue creation).
- Study blocks: no "Come si studia" section and no renamed labels; no published `examQuestions`, so the oral simulator shows its empty state in production (V2.2).
- Image viewer: no magnification presets; existing images still use free-text magnification. No published image has a `group`.
- Pathway step text is `ai-generated-unreviewed`. Closed on 2026-11-04: an independent verifier re-checked the pathway and p01 (see the review fixes below). Still open: the pathway page is not in the command-palette page list.
- Entity pages score 91–94 on Lighthouse performance (render-blocking CSS ~900 ms); the margin over 90 is small.
- Full Playwright runs here use `--workers=4`; at default parallelism builders saw timeouts on this machine.
- Not done: Firefox locally, real iOS/Android devices, Lighthouse on Linux. No DECISIONS entries yet for DB v2 and export schema 2 (OpenSeadragon is recorded as planned only, D059); CONTENT_SCHEMA does not yet describe the new source fields and the `classification` block.
- The A-/A+ control appears only on entity and pattern pages; the size applies site-wide.

## V2.1 review fixes (2026-11-04) — merged on `main`, not pushed

An adversarial review of V2.1 found 49 problems (4 blockers, 14 major, 31 minor). Some were fixed before `ec5fb2d`. Five fixer branches closed the rest, and each fixer reported every finding in its area as fixed. They were merged with `git merge --no-ff` in this order: `w1b/science-docs` (`c7aae15`), `w1b/ci-security` (`cb99b60`), `w1b/study` (`a4f5ced`), `w1b/viewer3d` (`198a310`), `w1b/reading` (`e9859e9`).

| Area | What was fixed |
|---|---|
| Science and docs | The independent re-check is applied to the pathway and p01: 61 ledger rows now name `independent-verifier-agent`, and the Method page counts the rows that only their writer or fixer checked (18 pages). p01 matrix cells carry claim markers (D060). A page must list every source its ledger relies on (D062). The 3ZCF note now says "deposited model". DECISIONS gained D051–D062; COMPLIANCE_PLAN, NAVIGATION_SPEC and CONTENT_SCHEMA were updated to match the code (the WHO source fields and the `classification` block are still undocumented) |
| CI and security | zod 4.6.7, undici 8.12.3 and 6.29.1 (`npm audit --omit=dev`: 0 vulnerabilities). The WHO watch opens one summary issue for more than 10 changes and neutralises corrigenda labels. A pathway page goes into the offline pack of the card that links to it. A dist test checks the worker `VERSION` |
| Study | Oral import checks every field and lists a damaged session so it can be deleted. A database that cannot be opened shows the storage notice, not "no sessions saved". A double press saves once. Focus stays in the setup after "Start again" (oral and quiz). Answers spread thinly over the levels give "too few". ARCHITECTURE states the roll-forward rule for `DB_VERSION` |
| Viewer and 3D | Our changes to an image, its stain and its magnification show in the page language (76 image YAMLs). Numbered labels that still touch are moved apart. The full-screen dialog has a short name. The 5 SVG diagrams render. A structure that fails on a later step falls back to its poster and description. Every poster is opaque, with the model at least 3:1 against the stage |
| Reading | Summaries, sources and atlas lists keep to the measure. On phones the lens chips, tools and objectives fold behind toggles: once the first-launch notice is closed, the first paragraph at 375 × 812 starts at 984 px instead of 2,214 px (measured again on `main`, Chromium and WebKit). Pattern pages have section chips and side contents. The site name shows whole, or as "Atlante", down to 320 px |

Integration:

- `src/pages/[lang]/pattern/[id].astro` conflicted. Both sides are kept: the reading layout (contents, sections, card list with summaries) and the matrix cells rendered through `stepHtml`, so claim markers stay HTML comments. `tests/e2e/pages.ts` merged cleanly but listed the pattern template twice; the `en` entry is kept.
- `package-lock.json` changed (zod, undici), so `npm ci` ran. `npm run licenses` left `dependencies.json` as the ci-security branch committed it.
- `2c664cd` fix(motion): under reduced motion, `base.css` gave every element a 0.01 ms transition, and `transition-property` defaults to `all`. So when the image viewer fitted the labels a second time (after the web fonts loaded), it read the old position of a moved number and left two numbers on top of each other at 375 px. Under load the label test failed 2 of 12 runs, and an instrumented replay over every labelled page failed 4 of 16. With `0s` the label test passed 16 of 16 runs in Chromium and 8 of 8 in WebKit, and the replay 24 of 24.
- `b102332` test(keyboard): under heavy load headless Chromium held `requestAnimationFrame` for 22 s during the tab walk on `it/e/apoptosis/`, so one key press hit the 30 s timeout (the reading fixer saw the same stall on `en/atlas/`). A 500 ms timer now bounds that wait; `keyboard.spec.ts` passed 180 of 180 runs before the change and 90 of 90 after it.

The local copy of the reference text had about 1,000 garbled lines (characters shifted by −29). They are now decoded, so no-verbatim also compares against text it could not read before. On the first run it found two shared 12-word runs in `docs/ledger/p01-necrosis.yaml` (claim c021), and `w1b/science-docs` reworded that claim.

Verification on `main` after the merges and the two fixes:

| Command | Result |
|---|---|
| `npm run check` | 0 errors, 0 warnings, 0 hints (204 files) |
| `npm test` | 212 passed, 2 skipped |
| `npm run build` | 320 pages; Pagefind 286 pages; `sw-manifest: shell 60 files, 2 offline pack(s)`; the known chunk-size and `[EVAL]` warnings from the lazy 3Dmol chunk |
| `npm run test:dist` | 17/17 passed |
| `npm run contrast` | all 94 pairs pass |
| `npm run guard` | ok (698 checked files) |
| `npm run licenses` | 570 packages, 9 documented exceptions; `dependencies.json` unchanged |
| `NO_VERBATIM_WORK=…/.work npm run no-verbatim` | 306 files, 0 failed |
| `E2E_ENGINES=chromium,webkit npx playwright test --workers=3` | 775 passed, 235 skipped by design, 0 failed (final run, 7.2 min). The two runs before it each had one failure: the label overlap test (fixed in `2c664cd`) and a keyboard walk stalled by a 22 s rAF wait (bounded in `b102332`) |
| `npm run test:e2e:study` / `npm run test:e2e:offline` | 27 passed, 3 skipped / 6/6 passed |
| `npm run lighthouse` | `/it/`, `/en/atlas/`, `/it/about/`: performance 99, 100 in the other three. `node scripts/lighthouse-assert.mjs` on six v2 pages: performance 90 (`/it/e/apoptosis/`), 93, 94, 97, 97 and 99; 100 in the other three; no CLS loss |
| `E2E_ENGINES=firefox npx playwright test --grep @smoke` | not run: Firefox is not installed locally, and the browser download needs the owner's approval |
| public-naming grep over tracked files, `dist/` and the new commit messages | 0 hits |

Open after the review fixes:

- Not pushed: CI, deploy, the live smoke test and the first WHO watch run on GitHub have not run on these commits.
- Some claims were checked only by their writer or fixer: 4 on the pathway, 21 on p01 (including the new c057–c063) and 212 older rows in 16 g01 ledgers. The Method page states these counts, and REVIEW_QUEUE has 3 new rows for a human.
- The text inside the 5 g01 SVG diagrams is in English only; caption and alt are bilingual.
- Oral page: once exam questions are published (V2.2), a returning learner's history fills in after load and can move the footer (CLS 0.00066 at 1920 × 1080 in the drafts build; production shows the static empty state).
- Import checks every field only for oral sessions. Other stores check only `id` and `updated`, so a crafted file with a valid checksum could still break the Me dashboard.
- Focus falls to `<body>` after "Next" in image training and in the chain exercise (found by reading the code, not fixed).
- On phones the top bar, chip strip and tab bar take 186 px (232 px at the largest text size). Touch targets are 2.75rem, which is 39.6 px at A−.
- Structure files have no content hash in their names. Until a returning visitor accepts the worker update, the old worker serves its cached copy.
- `npm audit` lists 21 moderate advisories, all in development tools. `ci.yml` pins actions by tag, not by SHA.
- `/it/e/apoptosis/` scores exactly 90 for Lighthouse mobile performance (FCP and LCP from 134 KB of HTML and render-blocking CSS).
- OpenSeadragon is planned only (D059).

### Second review and final fixes (2026-11-07) — on `main`, not pushed

Fresh reviewers re-checked `main` and found 25 items still open or newly broken (7 major, 18 minor). A first final fixer stopped at a usage limit after `00389cd` (the database notices) and left 56 files uncommitted. The second final fixer reviewed that work, kept it, corrected two parts and finished the rest: 21 commits, `00389cd` to `9a2947b`.

| Area | What changed |
|---|---|
| Science and licences | The card that hosts a pathway lists the pathway's sources, so the apoptosis card now cites the three papers its sources-differ aside reports (D062; dist test). The AI line on `/` links to the Method page in both languages. p01 claims c057, c059, c061, c063 and c015 are reworded in our own structure. c063 was reworded a second time, cause first: the first rewording still followed the reference point by point. The Licences page reproduces the notice of every library the site runs (dist test). The Method page now names every kind of text that has no ledger rows, including the words in our diagrams |
| Reading | Five more blocks keep the measure. The badges flow around the folded lens toggle, so no card scrolls sideways at 320–375 px with text l or xl. Our five diagrams have Italian copies (`fileIt`). Our credit lines are in the page language, and their link shows the licence name. The pattern matrix takes the full width on desktop. In the first version the sticky side list covered the matrix's last column, and the keyboard walk failed at 1280 px. Now the list and the text share a lead block, and the list stops where that block ends. On phones the chip strip slides away while the learner reads down. The oral history (folded to one line), the hub resume card (two lines reserved) and the tool-form checkboxes no longer shift or misalign |
| Learner data | Every waiting tab shows the blocked notice after 1.5 s. The database notice and the update notice share one column, can be dismissed and keep focus clear (`00389cd`). Import keeps the readable records of every store and says how many it left out. The checks live in `import-check.ts`, which only the data page loads, so the database chunk drops from 4.2 to 2.6 KB gz. Answer times use `performance.now()`. The calibration verdict says when accuracy does not rise with confidence |
| CI and security | Study data is network-first in the service worker, so an offline pack no longer keeps old questions. The WHO watch prints an Item URL only for https WHO and NIH links, keeps fetched Markdown inert and finds its marker on any line. Every action in `ci.yml` is pinned by SHA (checked again with `git ls-remote`). The JS budget now also counts the dynamic imports that load at once (`/it/study/`: 20.8 KB, not 4.0 KB) |

Verification on `9a2947b`:

| Command | Result |
|---|---|
| `npm run check` | 0 errors, 0 warnings, 0 hints (207 files) |
| `npm test` | 232 passed, 2 skipped |
| `npm run build` | 320 pages; Pagefind 286 pages; `sw-manifest: shell 61 files, 2 offline pack(s)` |
| `npm run test:dist` | 21/21 passed |
| `npm run contrast` / `npm run guard` | all 94 pairs pass / ok (706 checked files) |
| `NO_VERBATIM_WORK=…/.work npm run no-verbatim` | 306 files, 0 failed (and 10 SVG files under `src/assets/images`, 0 failed) |
| `E2E_ENGINES=chromium,webkit npx playwright test --workers=3` on reading, cls, a11y, keyboard, nav | 663 passed, 67 skipped by design, 0 failed |
| the same on pathway, i18n, privacy | 73 passed, 157 skipped by design, 0 failed |
| `npm run test:e2e:study` / `npm run test:e2e:offline` | 32 passed, 3 skipped / 8/8 passed |
| `npm run lighthouse` | `/it/`, `/en/atlas/`, `/it/about/`: performance 99, 100 in the other three. Six more pages: 88 (`/it/e/apoptosis/`), 90, 94, 97, 97 and 99; 100 in the other three |
| public-naming grep over tracked files, `dist/` and the new commit messages | 0 hits |

The following items from the list above are now closed: the English-only text in the SVG diagrams, the shift on the oral page, the import checks that covered only oral sessions, and the action tags in `ci.yml`. On phones the chrome is shorter while the learner reads down.

Still open:

- No fresh-context verifier has re-read the reworded p01 rows (c057–c063, c015). They stay labelled as checked by the fixer, and the Method page counts them that way.
- The words in our diagrams have no claim markers or ledger rows, like captions and alt text (the Method page says so). The diagrams have no dark-mode style.
- The sticky bars are sized in rem, so A+ enlarges them too. Changing that needs px-sized bars and new scroll-padding offsets, and is left for its own reading pass.
- `/it/e/apoptosis/` scores 88 for Lighthouse mobile performance locally, down from 90. `serve-dist.mjs` sends HTML uncompressed, and the page's 138 KB of HTML now sit just past a simulated round-trip step: with 3.4 KB less HTML it scores 90 again. GitHub Pages sends the page gzipped (32 KB). The CI sample pages are unaffected.
