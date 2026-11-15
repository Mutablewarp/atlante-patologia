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

- The words in our diagrams have no claim markers or ledger rows, like captions and alt text (the Method page says so). The diagrams have no dark-mode style.
- The sticky bars are sized in rem, so A+ enlarges them too. Changing that needs px-sized bars and new scroll-padding offsets, and is left for its own reading pass.
- `/it/e/apoptosis/` scores 88 for Lighthouse mobile performance locally, down from 90. `serve-dist.mjs` sends HTML uncompressed, and the page's 138 KB of HTML now sit just past a simulated round-trip step: with 3.4 KB less HTML it scores 90 again. GitHub Pages sends the page gzipped (32 KB). The CI sample pages are unaffected.

### Independent re-check of self-checked rows (2026-11-07) — on `main`

Fresh-context verifiers re-read the 27 rows on the pathway, p01 and apoptosis that only their writer or fixer had checked (21 on p01, 4 on the pathway, 2 on apoptosis). No claim was contradicted. Three rows were partly supported (p01-c010, pathway-c023, apoptosis-c074), eight p01 rows followed the reference too closely (c009, c013, c017, c022, c039, c043, c059, c063), and three public texts said more than their ledger row (p01-c037, p01-c046, apoptosis-c073); apoptosis-c042 was added for its close wording. A fixer reworded these rows (`f467074`, `a5d3555`, `a67b22c`). A second fresh verifier re-read them: all were supported, but c039, c043 and c059 still followed the reference, c062 kept a six-word run and the c017 body added a detail; its own wording replaced those (`8a5cd04`, `b6de0fd`).

All rows on these three pages now name an independent verifier, so they left the Method page list (`src/lib/self-verified.ts`): 15 older g01 ledgers with 210 self-checked rows remain, and V2.2 re-checks them.

| Command | Result |
|---|---|
| `npm test` / `npm run check` | 232 passed, 2 skipped / 0 errors, 0 warnings, 0 hints |
| `npm run no-verbatim` | 306 files, 0 failed |
| `npm run build` / `npm run test:dist` / `npm run guard` | OK (Pagefind 286 pages) / 21/21 / ok (706 files) |
| Playwright, chromium and webkit, 190 tests on the changed pages | 119 passed, 71 skipped by design, 0 failed |

Left open: c043 repeats the brain-cyst fact of c018; c056's second source (al-wahbi-2018) was not re-read in this pass.

## Reading refinement for tablet and desktop (2026-11-08) — merged into `main` on 2026-11-08

The owner asked for easier navigation and clearer, slightly denser text on iPad and computer, in a face that does not tire the eyes. Atkinson Hyperlegible Next stays the body face (it tells I/l/1 and 0/O apart best: IL-1, CD10, "tipo I/II") and Fraunces stays for headings; the request is met by tokens, weight and rendering (D063–D068). Phones keep their layout, apart from shared fixes: focus rings, card order, the scroll spy, keyboard focus in the chip strip and study forms that overflowed. 16 implementation commits (`5feb5e8`…`02b031d`), three fresh reviews (design, accessibility, regression), then 12 fix commits (`979d88d`…`32c7175`).

| Area | What changed |
|---|---|
| Text, from 600 px (D064) | Body 17.7 px on an iPad in portrait, 19 px from 1110 px; line height 1.5; measure 31em; weight 430; paragraph gap 0.85em; muted ink 7.76:1 (light) and 9.38:1 (dark); compact tables; the lede in ink; font smoothing in dark mode only; Greek letters from the Source Sans 3 subset (D063, every width) |
| Card header (D065) | Lens chips, less used tools and objectives fold at every width; bookmark and quiz stay in the toolbar row from 600 px |
| Navigation (D066–D068) | Chapter dialog on tablets, previous/next beside the breadcrumb, a second skip link to the text, a section list that ends with "Collegamenti" and a link to the next card, a reading-line scroll spy, cards ordered by the page language |
| Layout and touch (D068) | Side list 9.5rem at 1024–1279 px; one centred block from 1280 px; opaque bars from 600 px; 44 × 44 px touch targets from 600 px |
| Review fixes | The new tokens had reached phones: phones have main's values again. The other-language name is in Fraunces again (its late Atkinson italic moved the line on iPads). The pager is out of print. A focused chip stays whole and the page still. One name for each next-card link. Selected text on filled controls, a forced-colours cue, the palette button's name, the bookmark star. Study forms no longer widen their card or a phone page (also on main) |

Measured on `it/e/coagulative-necrosis/`, Chromium, first visit, before (main) → after:

| Viewport | Characters per line (median) | Body size / line height | First sentence ends at (screen height) | Card height |
|---|---|---|---|---|
| iPad 768 × 1024 | 61 → 66 | 18.3/30.2 px → 17.5/26.2 px | 1640 → 954 px (1024) | 17957 → 15521 px (-13.6 %) |
| iPad 820 × 1180 | 61 → 66 | 18.5/30.5 px → 17.7/26.5 px | 1648 → 907 px (1180) | 17971 → 15493 px (-13.8 %) |
| iPad Pro 1024 × 1366 | 46 → 59 | 19.0/31.4 px → 18.6/27.9 px | 1657 → 843 px (1366) | 20892 → 16774 px (-19.7 %) |
| iPad 1180 × 820 | 60 → 66 | 19.0/31.4 px → 19.0/28.5 px | 1491 → 808 px (820) | 18410 → 16064 px (-12.7 %) |
| Desktop 1440 × 900 | 61 → 66 | 19.0/31.4 px → 19.0/28.5 px | 1415 → 811 px (900) | 18016 → 16077 px (-10.8 %) |
| Desktop 1920 × 1080 | 61 → 66 | 19.0/31.4 px → 19.0/28.5 px | 1415 → 811 px (1080) | 17953 → 16077 px (-10.4 %) |
| Phone 375 × 812 | 38 → 38 | 17.1/28.3 px → 17.1/28.3 px | 1022 → 1022 px (812) | 20968 → 20996 px (+0.1 %) |

WebKit: 58 → 61 characters a line at 820 px, 57 → 61 at 1180 px, 58 → 61 at 1440 px; the first sentence is on the first screen at all three (it was 1.4–1.8 screens down).

Other measurements on the final build:

- CLS: 0 of 105 first visits (5 cards × 7 sizes × reading sizes M, L and XL, CPU 4× slower). At `02b031d` 15 of 105 shifted.
- Phones (375 × 812 and 390 × 844, Chromium and WebKit, light and dark, 8 pages) against the merge-base build: the same page heights and element boxes, except the next card at the end of coagulative necrosis (card order, +28 px). With the font smoothing set equal on both builds, 0–0.01 % of the pixels of the first three screens differ.
- Keyboard in the chip strip (768–820 px and 375 px, pattern and card, both directions, Chromium and WebKit): 400 stops, every focused chip whole, no page jump between two chips. Before: a chip could be 100 % hidden, and each Shift+Tab scrolled the page by about 560 px.
- Study forms on phones: the quiz scrolled 54 px sideways at 375 px, and up to 207 px at 320 px with size XL. Now 0 at 320–599 px, in every size.

Verification on `32c7175`:

| Command | Result |
|---|---|
| `npm run check` | 0 errors, 0 warnings, 0 hints (210 files) |
| `npm test` | 233 passed, 2 skipped |
| `npm run build` | 320 pages; Pagefind 286 pages; `sw-manifest: shell 63 files, 2 offline pack(s)`; the same warnings as main (3Dmol chunk size and its `eval`) |
| `npm run test:dist` | 21/21 passed (JS budgets included) |
| `npm run contrast` | all 112 pairs pass (94 before: the phone and the tablet muted ink are both checked now) |
| `npm run guard` | ok (709 checked files) |
| `npm run licenses` | 571 packages, 9 documented exceptions; `dependencies.json` unchanged (the scan's new date was put back) |
| `NO_VERBATIM_WORK=…/.work npm run no-verbatim` | 306 files, 0 failed |
| `E2E_ENGINES=chromium,webkit npx playwright test --workers=3` | 968 passed, 332 skipped by design, 0 failed, 0 flaky (11.0 min). Seven new tests (70 runs, skips by width included): CLS at 1180 × 820 and 1024 × 1366 (sizes L and XL), the keyboard walk into the chip strip, the phone text values, print and the study forms. Run on the `02b031d` build, each fails wherever it is not skipped |
| `npm run test:e2e:study` / `npm run test:e2e:offline` | 32 passed, 3 skipped / 8/8 passed |
| `npm run lighthouse` | `/it/`, `/en/atlas/`, `/it/about/`: performance 99, 100 in the other three |
| `node scripts/lighthouse-assert.mjs /it/e/coagulative-necrosis/ /it/pattern/p01-necrosis/ /it/atlas/` | performance 90, 94 and 99; 100 in the other three |
| `impeccable detect` on the 12 changed CSS and Astro files | 5 findings, all known side-tab false positives (stain-coded callouts, the disclaimer notice, the recall box, revision weeks, the look-for rule) |
| Firefox | not run: not installed locally (CI runs it) |

Still open:

- Not merged and not pushed: CI (with Firefox), deploy and the live smoke test have not run on these commits. Real iPad Safari and VoiceOver were not tested.
- Phones share changes beyond the named shared fixes: the Greek subset (D063), font smoothing in dark mode only (iOS and Android ignore it), the eosin selection wash, the caret colour, and the current chip set in the weight of the other chips (it no longer widens and moves its neighbours). None of them moves the layout; the lead should confirm them as shared.
- The other-language name is again a slanted Fraunces roman, as on main. A real italic needs either a preloaded italic face (Performance cost) or a metric-matched fallback.
- On touch iPads at 744–819 px the Italian reading toolbar wraps once, because A− and A+ are 44 × 44 px (as on main).
- At 320 px with size XL, three lens-term pagers and the roadmap table still scroll sideways by 3–60 px, as on main. Letting the term pager wrap would also restack it at size M on phones (156 of 180 page and width cases at 375 and 390 px).
- The quiz options run 1115 px wide at 1440 px, well past the reading measure, as on main: the runner is not inside the 48rem study column (NAV-15).
- `/it/e/coagulative-necrosis/` scores 90 for Lighthouse mobile performance locally (FCP 2.6 s); `02b031d` and main score 91 (FCP 2.5 s) in the same conditions. The card's CSS grew by 0.4 KB gzipped (2 KB raw), and `serve-dist.mjs` sends it uncompressed.

## Interactive body (plan §8) — in progress on `feat/body` (2026-11-13)

- Decided and written: `docs/BODY_SPEC.md` (binding spec), `scripts/anatomy/organ-map.yaml` (56 organ nodes: 40 with a BodyParts3D mesh, 4 fitted from HRA female objects, 6 proxies, 1 schematic, 5 without a model; every concept name resolved against the BodyParts3D tables), `plan/body-tasks.md` (25 tasks, 18 for coder agents), `scripts/agent/run-task.mjs` (runs one coder task on a lean agent and checks the files it wrote; 8 tests). Decision D073; source facts in VERIFIED_FACTS §N.
- Done on `feat/body` (lead session, coder tasks on lean Sonnet agents via `run-task.mjs`; one commit per task): setup (three 0.187.0 and the glTF tools, licence scan 594 packages, 0 failed); B-0a to B-0e (measured facts in spec §11); B-2a, B-2b and B-2c (the page `/it/body/` and `/en/body/`: tree data, markup, styles, entry link on the Atlas page, e2e). Costs of the coder runs are in `.work/usage.jsonl` (B-0b $0.25, B-0d $0.22, B-2a $0.43, B-0c $0.30, B-2b $0.35, B-2c $0.30).
- Measured (B-0): BodyParts3D is millimetres, Z up, front −Y, left +X; 4,070,572 triangles in the 40 mesh organs; 4.4 to 7.4 bytes per triangle after meshopt; spike chunk 173,496 bytes gzip; 58.7 fps on an iPad simulator. Changes to the organ map: the cervix is `hra` (the HRA uterus object has a cervix, no vagina), the peritoneum is a `proxy` (BodyParts3D has only three mesenteries). Licence finding: the OBJ headers still name CC BY-SA 2.1 Japan, the 2025 pages name CC BY 4.0 (spec §2, VERIFIED_FACTS §N).
- Not done yet: asset build (B-3), viewer (B-4, B-5), the body on the home page (B-9), cards and progress (B-6, B-7), polish (B-8). Not measured: frame rate on desktop and on a real device, the whole body at about 238,000 triangles.

## Content campaign (all 35 modules) — prepared 2026-11-13

- Owner request: every module published, the body on the home page, phone first (D074).
- Written: `plan/content-campaign.md` (the batch loop with commands, stop rules, three tooling tasks for planned lists, module status and progress by cards), `scripts/agent/audit-batch.mjs` (5 tests). The verifier and fixer role cards changed as in D074.
- 2026-11-13: card lists written for the 8 modules without a row and for `g09` (89 cards, batches W20–W24, from the reference's chapter outlines); the private manifest has 467 rows for all 35 modules.
- Open: batch W01 (`g10`): most of its cards have no pages in the reference and need a variant of the pipeline that writes from open second sources.

## V3 batch metrics

| Batch | Date | Cards | Tokens per card | Audit error rate | kB per card | CI |
|---|---|---:|---:|---:|---:|---|
| W02-pilot | 2026-11-13 | 4 | 5961 k | 0.0 % (0/60) | 75 | first-try |
| W03 | 2026-11-14 | 14 | 5543 k | 0.0 % (0/195) | 80 | first-try |
| W04 | 2026-11-14 | 19 | 5653 k | 0.0 % (0/60) | 81 | first-try |
| W05 | 2026-11-14 | 16 | 5696 k | 0.0 % (0/90) | 80 | rerun (CLS flake) |
| W06 | 2026-11-14 | 15 | 5380 k | 0.0 % (0/60) | 78 | first-try |
| W07 | 2026-11-15 | 16 | 5478 k | 0.0 % (0/60) | 82 | first-try |
| W08 | 2026-11-15 | 19 | 5122 k | 1.7 % (1/60) | 79 | first-try |
| W09 | 2026-11-15 | 15 | 5974 k | 0.0 % (0/60) | 86 | pending |

Pilot C-0 (W02: thrombosis, amyloidosis, hyaline-change, inflammatory-mediators), notes of 2026-11-13:
- "Tokens per card" counts input, cache creation, cache reads and output of every run, reruns included (55 runs); cache reads of the fixed context dominate, so the plan's 450 k target (a different count) cannot be compared with it. The measure that matters is dollars at API prices from `.work/usage.jsonl`: $19.71 in all, $4.93 per card with the rework of the pilot (a path-guard bug, a missing shasum permission, a report-note limit, a scout without candidates, and a second pass through all stages after the distance stage was added). A clean run of the seven stages costs about $3.4 for a P0 core card, $2.2 to $2.8 for P1 and P2: about $1,000 for 378 cards. Plan usage moved by less than one point of the weekly limit while the pilot and its supporting session ran (20 % before and after).
- Audit: 15 claims per card (60 in all) checked against the cited pages by a fresh agent: 0 factual errors, 0 mistranslations. Close paraphrase (the content points of one source sentence in the same order with synonym swaps) was flagged in 23 of 60 claims before the distance stage and in 5 of 60 after it plus a second verifier and fixer pass; the verifier's own count of rows to fix fell from 15 of 73 to 3 of 72 (thrombosis) and from 27 of 51 to 2 of 41 (amyloidosis).
- The gates for the cards: check, unit tests, build, dist tests, Linux e2e (chromium) green on the branch; card pages weigh 75 kB on average (target 110 kB).

W03 (`g05`, 14 cards on neoplasia), notes of 2026-11-14:
- Cost: $68.61 at API prices for 186 runs, $4.90 per card (stop rule: $6 per card in two batches running). By stage: verifier $17.51, fixer $14.64, author $8.95, distance $8.28, scout $5.25, coverage $4.46, questions $3.40, audit $3.13, translator $2.98. "Tokens per card" uses the count of the pilot row, cache reads included.
- Audit: 195 claims checked against the cited pages in four rounds (60 in the first audit of four cards, 60 in the same cards after their strict pass, 15 in `serum-tumor-markers` after 13 claims were added from a wider packet, 60 in four of the other ten cards after their strict pass): 0 factual errors, 0 mistranslations. Close paraphrase: 11 of 60 in the first audit, sorted as 8 with wording or a list taken from the source and 3 borderline. The strict verifier and fixer pass then read all 14 cards (four before publication, ten after it as a follow-up; it is a standard stage from W04 on): 178 rows reworded, no claim removed, three partly supported rows corrected. After it the audits found 3 of 60, 2 of 15 and 2 of 60; all seven are a short definition or a fact of two or three steps in its natural order, which BRIEF section 2 allows: counted, not changed.
- Cards left out: none. Left out inside the cards: must-cover items that the packet pages do not contain (19 of the 30 `not-found-in-reference` rows of the batch in `docs/REVIEW_QUEUE.md`), most of them because a packet is cut at 60 kB and drops the pages listed last in the manifest row; `carcinogenic-agents` lost 3 supported claims to its 500-word cap. `finalize-batch.mjs` now keeps the fragment lines that are not table rows.
- Gates: the Linux e2e ran in CI on the pushed branch (three engines), because Docker on the work machine does not start containers; branch CI and CI on main were green at the first try; live smoke with the host browsers. `dist/` is 79 MB of its 400 MB budget with 44 cards.

W04 (`o17`, the heart, 19 cards), notes of 2026-11-14:
- Cost: $98.57 at API prices for 228 runs, $5.19 per card (stop rule: $6 per card in two batches running; W03 was $4.90). By stage: verifier $23.93, fixer $21.27, author $17.08, distance $12.38, questions $6.88, scout $6.63, translator $5.27, coverage $4.22, audit $0.92. The strict second pass on all 19 cards cost $21.25 (about $1.12 per card).
- Audit: 60 claims in four cards (`ischemic-heart-disease`, `mitral-valve-prolapse`, `hypertrophic-cardiomyopathy`, `arrhythmia-substrates-and-sudden-cardiac-death`) after the strict pass on every card, which removed no claim: 0 factual errors, 0 mistranslations. Close paraphrase: 4 of 60, all of the sort BRIEF section 2 allows (a fact of three steps, a gross description in three points, a list of three standard disease names, four standard substrates under a split in swapped order): counted, not changed. Coverage of the 19 cards found 14 questions in 10 cards that rest on a fact the card does not state (why-questions that join two claims); two rounds of the questions stage with a note rewrote them, none is left. Every must-cover gap has a `not-found-in-reference` row (four rows added after the packets were checked).
- Cards left out: none. Claims cut for the word cap in the second distance run: `ischemic-heart-disease` 87 to 67, `cardiac-hypertrophy-and-heart-failure` 72 to 61 (listed in the review queue).
- Process defects found: `run-batch` runs the `distance` stage only right after `author` in the same pass, so two cards whose author was rerun by hand (`rheumatic-heart-disease`, `myocarditis`) were translated without it; the run was stopped and distance and translation were redone by hand (`ops/redo-distance.sh`). A scout agent hung for 70 minutes because it ignored SIGTERM: the stage runner now sends SIGKILL 15 seconds after the 25-minute limit (`5185f89`).
- Gates: the HTML weight gate failed at 63 published cards because the sidebar chapter index listed every card of every chapter on every card page; D075 replaced it (a page per chapter, an index with the cards of the current chapter only) and the gate is unchanged. The Linux e2e ran as the CI of the pushed branch (three engines). `dist/` is 90 MB of its 400 MB budget with 63 cards.

W05 (`o16`, `g07`, `o18`: arteries, veins, lungs; 16 cards), notes of 2026-11-14:
- Cost: $77.66 at API prices for 208 runs, $4.85 per card (stop rule: $6 per card in two batches running; W03 $4.90, W04 $5.19). By stage: verifier $19.17, fixer $17.28, author $12.14, distance $9.04, scout $6.52, questions $4.96, coverage $3.59, translator $3.44, audit $1.51. The strict second pass on all 16 cards cost $15.77; a third, targeted reading of two cards cost $3.01.
- Audit: 90 claims in all, 0 factual errors, 0 mistranslations. First audit: 60 claims in four cards after the strict pass on every card (which removed no claim): 8 close paraphrases, 6 of them in `anca-associated-vasculitis` (6 of 15). A third reading of that card and of `atherosclerosis` with a stronger note ("read every row strictly, assume many are as close") made the verifier flag 29 of 82 and 21 of 76 rows that the strict pass had left; after the fixer, an audit of 30 claims found 2 close paraphrases, both of the sort BRIEF section 2 allows (a list of five symptoms regrouped, a fact of two points). The short strict-pass note is too weak on some cards: the stronger wording is in the message to the orchestrator. Coverage of the 16 cards found 7 questions in 6 cards that rest on a fact the card does not state; three rounds of the questions stage (the first was cut by the plan usage limit) cleared them. Every must-cover gap has a `not-found-in-reference` row (the auditor does not read the fragments and reports them as missing).
- Cards left out: none. Claims lost to the word cap: `pulmonary-embolism` 76 to 70, `pulmonary-hypertension` 72 to 68.
- Process: the author and the scout of `atherosclerosis` each hung for 25 minutes without a report and were killed 15 seconds after the limit (the SIGKILL fix of `5185f89` worked); two scouts were denied the shell or saved Wikimedia error pages (3290-byte HTML) as images, which were deleted; the author of `polyarteritis-nodosa` could not run `card:check` and was rerun. After the manual author reruns, `distance` and the translation were redone by hand (`ops/redo-distance.sh`). The plan usage limit cut the first repair run (exit code 3, nothing spent) and it was run again after the reset.
- Gates: all local gates green; the HTML weight gate passes with the chapter index of D075 at 79 published cards. `dist/` is 100 MB of its 400 MB budget (90 MB at 63 cards, 0.63 MB per card): at that rate the stop rule (320 MB) is reached near 430 cards, before the end of the programme.
- Publication: the branch CI of `383ecd4` was green at the first run, but `origin/main` moved twice during the wait (the body page and assets were merged) and the push of main was refused once (exit 43); the publish scripts now push `SHA:main` from the batch worktree first and fast-forward the main checkout only afterwards. After the merge of main the branch CI of `ae76fad` failed once, only in the chromium e2e job: two CLS tests at 768 px (`en/pattern/p01-necrosis/` in both attempts, the study hub returning learner in the first only) saw `nav-icon` shift by 7 to 9 px while the fonts loaded; the same tests pass locally and on main, and the rerun of the failed job was green (CI cell: rerun). Live: main and deploy green, home shows 79 of 486 cards, two cards checked on the live site (no broken image, no console error). `dist/` measured again after the merge of the body: 93 MB at 79 cards (the body assets add 1.4 MB); the deployed Pages artifact grew from 47 MB to 55 MB to 63 MB over the last three publications, about 0.5 MB per card, so the programme ends near 320 MB, at the stop rule of 80 % of the budget.

W06 (`o29`, `o18`, `g09`: nose and larynx, lung inflammation and airway disease, tuberculosis; 15 cards), notes of 2026-11-14:
- Cost: $71.79 at API prices for 179 runs, $4.79 per card (stop rule: $6 per card in two batches running; W03 $4.90, W04 $5.19, W05 $4.85). By stage: verifier $17.36, fixer $15.99, author $11.40, distance $8.40, scout $6.50, questions $4.85, translator $3.33, coverage $3.08, audit $0.87. The strict second pass on all 15 cards cost $14.92 (no claim count changed); the audits and the repairs after it cost $6.54.
- Audit: 60 claims in four cards after the strict pass: 0 factual errors, 0 mistranslations, 0 close paraphrases (W05 had 8 in 60 before its targeted third reading). Coverage found 8 orphan questions in 8 cards, cleared by two rounds of the questions stage (the second for `emphysema` alone), and 4 must-cover items without a not-found row: EBER, COVID-19, PCR and IGRA are not in the packets and got rows; the extrapulmonary sites of tuberculosis are on pp. 450-451 of the packet, so the fixer added claim c085 and a verifier checked it (it shortened the five-site list that the fixer first wrote, rule 2b).
- Cards left out: none. One image left out: the second micrograph of `atelectasis` (bronchovascular bundles, 214 kB as AVIF at 960 px) was dropped by the image-weight gate (466 kB of default images against 450 kB, commit `29f907b`) and is recorded in `docs/MISSING_ASSETS.md`.
- Process: the first launcher pass ran 97 stages ($46.37) and left four stages to do by hand: the author of `laryngeal-squamous-cell-carcinoma` ended after 25 minutes without a report (0 turns, no file) and was run again alone (done in 128 s; `distance` and the translation again by hand); the fixer of `tuberculosis` ended at the tool-call cap with en.md at 1210 words (cap 1200); the scouts of `atypical-and-viral-pneumonia` and `tuberculosis` ended blocked on oversized downloads: the role card asks for the 1600 px rendition and a re-encode with sharp through `node -e`, which the shell of an agent run denies (the same failure in W04 and W05). The oversized files were deleted and the scouts run again with the 960 px thumbnail; a change of the role card is proposed to the orchestrator. The author of `nasopharyngeal-carcinoma` wrote its planned fragment as the bare string `nasopharyngeal-angiofibroma` (no module, no names): `finalize-batch` did not merge it, and that card is not in the programme manifest.
- Gates: close-2 had check, 614 unit tests, build, guard, contrast (112 pairs) and no-verbatim green; `test:dist` failed once (the `atelectasis` image weight above) and passes after the fix (31 tests). `dist/` after a clean build at 94 published cards: 117 MB of 400 (`_astro`, almost all images as AVIF at 960 and 1280 px and WebP, is 76 MB), against 93 MB at 79 cards: 1.6 MB per card for the 15 cards of W06, which carry more images than the cards of W05 (0.6 MB per card). At the W06 rate the stop rule (320 MB) is reached near card 220 of 486: the weight of the images needs a decision before then.

W07 (`o18`: lungs and pleura, from interstitial disease to mesothelioma; 16 cards), notes of 2026-11-14 and 2026-11-15:
- Cost: $71.74 at API prices for 186 runs, $4.48 per card (stop rule: $6 per card in two batches running; W03 $4.90, W04 $5.19, W05 $4.85, W06 $4.79). By stage: verifier $18.35, fixer $14.92, author $11.28, distance $8.02, scout $7.79, questions $4.24, translator $3.61, coverage $2.81, audit $0.71. The strict second pass on all 16 cards and its two reruns cost $15.57 (no claim count changed); the audits and the repairs after it cost $4.52. With this batch module `o18` has all its 27 cards. The pattern row `interstitial-lung-disease` is not written by the tools (pattern rows come later).
- Audit: 60 claims in four cards (`idiopathic-pulmonary-fibrosis`, `silicosis`, `lung-adenocarcinoma`, `lung-metastases`) after the strict pass: 0 factual errors, 0 mistranslations and 2 borderline close paraphrases of the allowed sort (a list of technical terms kept in the source order: `idiopathic-pulmonary-fibrosis-c025`, `silicosis-c029`; counted, not changed). Coverage found 6 orphan questions in 5 cards, cleared in two rounds of the questions stage (the second for `lung-metastases` alone: a rewritten question named organs the ledger does not give), and 7 must-cover items without a not-found row (berylliosis, the other causes of lung cancer, sampling, napsin A, the driver genes and PD-L1 of the adenocarcinoma, BAP1 and MTAP, STAT6): none is in the packets (whole-word searches), so all got rows. `ops/audit-flags.mjs` matched only words of five letters or more and reported items made of acronyms as not logged; it takes four characters now.
- Cards left out: none. Images left out: `lung-metastases` has no micrograph (no CC-licensed one was found); two cards lost one image each to the image-weight gate (`idiopathic-pulmonary-fibrosis` 455 kB of default images, its second micrograph; `lung-carcinoid-tumors` 569 kB, its gross photograph; commit `5d3ae84`); both are recorded in `docs/MISSING_ASSETS.md`.
- Process: the plan usage limit cut the first launcher pass at 18:51Z after 48 stages ($22.42) and left five stages blocked (the scout of `hypersensitivity-pneumonitis`, the authors of `lung-adenocarcinoma` and `lung-squamous-cell-carcinoma`, the verifier of `lung-cancer-overview`, the scout of `silicosis` that had hung for 25 minutes); they were run by hand with notes after the reset at 21:20Z, and `distance` and the translation again for the two authors. The second pass ran 60 stages ($24.81) and left the scouts of `lung-adenocarcinoma` and `lung-metastases` on oversized downloads (the shell of an agent run denies the `node -e` re-encode the role card asks for; the same failure as in W04 to W06), redone with the 960 px thumbnail. In the strict pass the fixer of `sarcoidosis` ended at the tool-call cap and the verifier of `idiopathic-pulmonary-fibrosis` hung for 25 minutes; the rerun of the latter was blocked once by the guard because another stage ran in the same worktree without `--siblings`, then done. The merge of main at close-1 conflicted only in this file (both sides had added rows); resolved by keeping both.
- Gates: close-2 had check, 614 unit tests, build, guard, contrast (112 pairs) and no-verbatim green; `test:dist` failed on the image weight of the two cards above and passes after the fix (31 tests). `dist/` at 110 published cards: 128 MB of 400 (117 MB at 94 cards, 93 MB at 79): 1.1 MB per card over W05 to W07 (W07 alone 0.7 MB). At that rate the stop rule (320 MB) is reached near card 285 of 486.

W08 (`o29`, `o19`: salivary glands, esophagus and stomach; 19 cards), notes of 2026-11-15:
- Cost: $81.54 at API prices for 212 runs, $4.29 per card (stop rule: $6 per card in two batches running; W03 $4.90, W04 $5.19, W05 $4.85, W06 $4.79, W07 $4.48). By stage: verifier $19.84, fixer $18.20, author $12.56, scout $9.09, distance $8.65, questions $5.06, translator $4.13, coverage $3.24, audit $0.77. The strict second pass on all 19 cards cost $17.89 (no claim count changed except one claim lost in `salivary-gland-tumors` at the repair); the audits and the repairs after it cost $5.63. With this batch module `o29` has all its 10 cards.
- Audit: 60 claims in four cards (`salivary-gland-tumors`, `adenoid-cystic-carcinoma`, `esophageal-carcinoma`, `gastric-polyps`) after the strict pass: 1 factual error (1.7 %), 0 mistranslations, 2 close paraphrases. The error is `salivary-gland-tumors-c044`: the card repeats the reference (rubin-8e p. 1324, "mainly in young men ages 20 to 30") on acinic cell carcinoma, which standard sources contradict (a slight female predominance and a wide age range); the verifier had passed it because it checks the packet pages only. A fixer with a note removed the claim (no other item rested on it) and a source-conflict row records it in the review queue. Close paraphrases: a copied run in `esophageal-carcinoma-c048` was reworded; a three-item standard list in `adenoid-cystic-carcinoma-c019` is counted. Coverage found 5 orphan questions in 4 cards, cleared in two rounds of the questions stage (the second for `barrett-esophagus` and `gastric-polyps`), and 2 must-cover items without a not-found row (the bilayer of the Warthin tumor, the Ki-67 grading of the neuroendocrine tumors): neither is in the packets, so both got rows.
- Cards left out: none. Image left out: the high-power micrograph of `gastric-adenocarcinoma`, which entered the page through the shared group of the low-power one although the scout had not listed it in meta.yaml, and brought the default images to 696 kB against the 450 kB cap; recorded in `docs/MISSING_ASSETS.md`.
- Process: the first launcher pass ran 133 stages ($56.80) and left three scouts blocked: those of `gastric-adenocarcinoma` and `gastric-malt-lymphoma` on oversized downloads (the shell of an agent run denies the `node -e` re-encode the role card asks for; the same failure as in W04 to W07; the lymphoma candidates were PNGs of 1.4 to 2.4 MB) and that of `gastrointestinal-neuroendocrine-tumors` with no report after 25 minutes; all three were run again with the 960 px thumbnail (`ops/scout-redo.sh`). In the strict pass the fixer of `mucoepidermoid-carcinoma` pasted its three fixes but ended `blocked` because its shell had left the worktree and `card:check` could not run; because of that stage `commit-finished` left the card out of the first close-1 run (18 of 19 cards committed), so the stage was run again (done) and the last steps of close-1 (commit, finalize, planned lists, module status) were run by hand. The planned fragment of `warthin-tumor` is the bare string `oncocytoma` (no module, no names; not in the programme): not merged, as in W06.
- Gates: close-2 had check, build, guard, contrast (112 pairs) and no-verbatim green; two gates failed: `test` (the references gate: `helicobacter-pylori-gastritis` and `peptic-ulcer-disease` each declared the `causes` relation towards the other, two authors working in parallel; the reversed one in `peptic-ulcer-disease` was removed) and `test:dist` (the image weight above). Both pass after the fix (commit `109e62a`: 614 unit tests, 31 dist tests). `dist/` after a clean build at 129 published cards: 148 MB of 400 (128 MB at 110 cards, 93 MB at 79): 1.1 MB per card over W05 to W08; the stop rule (320 MB) is reached near card 285 of 486.

W09 (`o19`: intestines, from infectious enterocolitis to colorectal adenocarcinoma; 15 cards), notes of 2026-11-15:
- Cost: $78.09 at API prices for 191 runs, $5.21 per card (stop rule: $6 per card in two batches running; W03 $4.90, W04 $5.19, W05 $4.85, W06 $4.79, W07 $4.48, W08 $4.29). By stage: verifier $19.55, fixer $18.25, author $11.41, distance $9.78, scout $7.61, questions $4.28, translator $3.51, coverage $2.84, audit $0.86. The strict second pass on all 15 cards (the first one was cut by the plan usage limit and run again) cost $17.69 (no claim count changed); the audits and the repairs after it, among them a third reading of `infectious-enterocolitis`, cost $6.81. With this batch module `o19` has all its 29 cards.
- Audit: 60 claims in four cards (`infectious-enterocolitis`, `malabsorption-syndromes`, `ulcerative-colitis`, `colorectal-adenoma`) after the strict pass: 0 factual errors, 1 half error and 7 close paraphrases. The half error is `malabsorption-syndromes-c071`: the card split the defects into luminal, mucosal or transport, the page names two phases (luminal and intestinal, with the transport inside the intestinal one); it was restated as the page does. Five of the 15 audited claims of `infectious-enterocolitis`, the card that had to be cut to the word cap, were too close to the source, so a third reading with the strong note (every row read strictly) found 27 rows too close and a fixer reworded 18 sentences (the card is at 1044 of 1200 words); the two borderline lists of standard terms in `ulcerative-colitis` are counted, not changed. Coverage found 5 orphan questions in 5 cards, cleared in two rounds of the questions stage (the second for `malabsorption-syndromes` alone), and 1 must-cover item without a not-found row (the mural infarction of `ischemic-bowel-disease`, absent from the packet): a row was added.
- Cards left out: none. Images: none dropped in this batch.
- Process: the first launcher pass ran 100 stages ($49.18) and left five stages blocked: the scouts of `ischemic-bowel-disease` (no report after 25 minutes), `microscopic-colitis`, `serrated-colorectal-lesions` and `lynch-syndrome` (oversized downloads: the shell of an agent run denies the `node -e` re-encode the role card asks for; the same failure as in W04 to W08; the Lynch candidate was a PNG of 2.2 MB) and the `distance` stage of `infectious-enterocolitis`: the card had been written at 1404 words against the cap of 1200 and the agent would not drop supported facts. The scouts were run again with the 960 px thumbnail and `distance` again with a note that allows dropping details that are not must-cover (each one logged as `dropped-for-cap` in the review queue), then the translation again. The plan usage limit cut the strict pass at 08:46Z: 14 of the 15 cards failed with exit code 3 and nothing was spent; after the reset the pass was run again.
- Gates: close-2 stopped at the build once: the bold terms of the Italian high-yield bullet 9 of `non-neoplastic-intestinal-polyps` were two against one in English; the study builder checks this parity, `card:check` and the unit tests do not; a fixer with a note aligned them (commit `566ac8d`). All gates pass after it (614 unit tests, 31 dist tests, no image over the weight cap). `dist/` at 144 published cards: 157 MB of 400.
