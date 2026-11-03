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
