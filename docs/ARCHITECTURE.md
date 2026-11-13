# Architecture

Status: PHASE 0 proposal, 2026-10-10. Versions come from [VERIFIED_FACTS.md](VERIFIED_FACTS.md) (checked the same day). Deviations from the brief are justified in [DECISIONS.md](DECISIONS.md).

## 1. Constraints that shape everything

| Constraint | Consequence |
|---|---|
| Free, no login, no trackers, no cookies, user data on device | Fully static site; all personal state in IndexedDB; zero third-party requests (tested). |
| GitHub Pages: site ≤ 1 GB, deploy ≤ 10 min, soft 100 GB/month, public repo on Free plan | Our own hard budget is **< 400 MB built site** (the brief said 300 MB; raised by decision D8 of the V3 plan together with the image diet), enforced in CI; images are the main cost. |
| Bilingual it/en with parity | Every authored item carries both languages in the same commit; parity is a build gate. |
| Offline-capable | Service worker precaches the app shell only; chapters are opt-in offline packs. |
| Accuracy and licensing gates before publishing | Content is `draft` until the validators and the claim ledger pass; only `published` content is built. |

## 2. Stack (pinned)

| Concern | Choice | Version | Note |
|---|---|---|---|
| Runtime (dev/CI) | Node.js LTS | 24.21.0 (`.nvmrc`: `24`) | v24 enters Maintenance 2026-10-20 and v26 becomes LTS 2026-10-28; switch after Phase 1 if the toolchain supports it (D003). |
| Package manager | npm | ships with Node | Lockfile committed; the Astro action detects it. |
| Site generator | Astro (static output) | 7.3.8 | Content collections + Zod 4 via `astro/zod`; built-in i18n routing. |
| Language | TypeScript, `strict` | 6.0.3 | Not 7.x: `@astrojs/check` 0.9.10 peer range is TS ^5 \|\| ^6 (D005). |
| Interactive islands | Preact + `@astrojs/preact` + `@preact/signals` | 10.29.8 / 6.0.6 / 2.11.3 | Not Preact 11: integration peer range is ^10.6.5 (D004). |
| Images | `astro:assets` + sharp | sharp 0.35.5 | AVIF page file, small WebP fallback, AVIF zoom file, lazy loading ([IMAGE_ENCODING.md](IMAGE_ENCODING.md)). |
| Search | Pagefind | 1.5.2 | Post-build; one index per `<html lang>`; diacritic-tolerant since 1.5.0; `baseUrl` for project-site subpath. |
| Spaced repetition | ts-fsrs | 5.4.2 (MIT, Node ≥ 20) | FSRS v6 scheduler. |
| Client storage | idb (IndexedDB wrapper) | 8.0.4 (ISC) | |
| 3D structure viewer | 3Dmol.js | 2.5.5 (BSD-3-Clause) | Loaded by a dynamic import only after "Load the 3D view"; kept out of the service-worker precache; reads committed CC0 BinaryCIF files written by `scripts/fetch-structures.mjs` (D050, D054). |
| Service worker | Hand-written, plus a build script that emits the precache list | — | `@vite-pwa/astro` does not support Astro 6/7 (D006). |
| Sitemap | `@astrojs/sitemap` | 3.7.4 | With i18n alternates. |
| Unit + content validators | Vitest | 5.0.3 | Validators are Vitest suites (D014). |
| E2E, a11y | Playwright + `@axe-core/playwright` | 1.64.0 / 4.13.0 | Chromium, Firefox, WebKit. axe is MPL-2.0, dev-only and not shipped. |
| Performance audit | `lighthouse` CLI + small assertion script | 13.5.0 | `@lhci/cli` not used: no release since 2025-06 (D007). |
| License scan | license-checker-rseidelsohn | 5.0.1 | Needs Node ≥ 24, npm ≥ 11. |
| Git hooks | simple-git-hooks | 2.14.0 | Pre-commit containment and no-verbatim guard. |
| Reference text for the guard | none in the repo | — | `scripts/no-verbatim.mjs` reads text extracted once into gitignored `.work/*.txt`; no PDF library is a dependency. PyMuPDF (AGPL) was used only for Phase 0 exploration, outside the repo (D016, superseded). |
| Fonts | Fraunces (display) + Atkinson Hyperlegible Next (body), with the Greek subset of Source Sans 3 for Greek letters, self-hosted via `@fontsource-variable/*` | 5.3.0 / 5.3.0 / 5.3.1 (OFL-1.1) | Bundled with the site, no third-party requests (D015 revised, D063). |

## 3. Repository layout

```
/
├─ .github/
│  ├─ workflows/ci.yml            # guard → lint/typecheck → validators → build → dist checks → e2e → deploy (main only)
│  ├─ ISSUE_TEMPLATE/             # content error, image/copyright takedown, accessibility, translation
│  └─ PULL_REQUEST_TEMPLATE.md
├─ docs/                          # planning, compliance, ledger/, licenses/
├─ public/                        # sw.js, manifest.webmanifest, icons, robots.txt
├─ scripts/                       # guard-staged, no-verbatim, sw-manifest, lighthouse-assert, crossref-check
├─ src/
│  ├─ content.config.ts           # collections; schemas imported from lib/schema.ts
│  ├─ content/
│  │  ├─ modules.yaml             # g01…o34: labels, order, status (planned | published)
│  │  ├─ taxonomy/<lens>.yaml     # lens terms with it/en labels
│  │  ├─ sources.yaml             # machine registry of sources (feeds the Reading list page)
│  │  ├─ entities/<id>/{meta.yaml,en.md,it.md}
│  │  ├─ patterns/<id>/{meta.yaml,en.md,it.md}
│  │  ├─ questions/<module>/<id>.yaml
│  │  ├─ images/<id>.yaml         # license + caption + alt + annotations
│  │  ├─ glossary/<id>.yaml
│  │  └─ paths/<id>.yaml
│  ├─ assets/images/<id>.<ext>    # originals; optimized at build
│  ├─ i18n/{it,en}.ts             # UI strings + canonical section titles
│  ├─ lib/                        # pure TS: schema, relations, lenses, cards, fsrs, db, url
│  ├─ components/                 # .astro (static)
│  ├─ islands/                    # .tsx (Preact) — hydrated only where needed
│  ├─ layouts/
│  └─ pages/                      # routes, see NAVIGATION_SPEC.md §3
├─ tests/
│  ├─ content/                    # pre-build validators (Vitest)
│  ├─ dist/                       # post-build validators on dist/ (Vitest)
│  └─ e2e/                        # Playwright
├─ reference/                     # GITIGNORED owner references (symlinks)
└─ .work/                         # GITIGNORED extraction output
```

## 4. Build pipeline

```
npm run build =
  astro build                         # Zod-validates every collection; renders only status: published
  && pagefind --site dist             # per-language indexes
  && node scripts/sw-manifest.mjs     # writes dist/precache.json (shell files + content hashes) and dist/packs/<lang>/<module>.json
```

1. **Content load.** Glob loaders read `src/content/**`. Zod schemas reject missing fields, missing language strings, unknown ids, and images without complete license data.
2. **Derived data** is computed once in `src/lib/`:
   - Relation graph: symmetric types are mirrored and directed types get inverse labels.
   - Lens membership.
   - Flashcards: generated from card fields (CONTENT_SCHEMA §7).
   - A compact per-language index (`/[lang]/data/index.json`: id, names, lens tags, module, relations) used by compare, the differential builder, the concept map and lens prev/next.
3. **Rendering.** Static `.astro` pages. Islands hydrate only interactive parts: section TOC scroll-spy, Quick/Full toggle, glossary popovers, image viewer, quiz, review queue, planner, compare, differential builder, concept map, command palette.
4. **Search.** Pagefind runs on the static HTML. Entity headers show all names (it, en, Latin, eponyms, synonyms) as visible text, so a search in either language finds them. Lens tags are exposed as Pagefind filters.
5. **Service worker manifest.** The build script lists the app-shell files (both language home pages, offline page, CSS/JS bundles, icons, manifest) with content hashes, and lists each module's URLs for offline packs.

## 5. Client architecture

| Feature | Where state lives | Notes |
|---|---|---|
| Preferences (language, theme, Quick/Full) | `localStorage` | Language-preference write happens only on explicit choice. |
| Study state (FSRS cards, review log), bookmarks, notes, highlights, error log, reading progress, quiz attempts, planner | IndexedDB `atlas` DB, versioned stores | `idb` wrapper; schema version in DB and export file. |
| Export/import | JSON file download/upload | Includes schema version and integrity checks; import merges by id and takes the newest timestamp. |
| Persistence | `navigator.storage.persist()` | Requested after the first meaningful action (first review saved), not on page load. Supported from Safari 17 and granted by heuristics. |
| Offline packs | Cache Storage `pack-<lang>-<module>-<hash>` | Opt-in per module. Storage meter uses `navigator.storage.estimate()`. Delete per pack. |

**Learner database versions only move forward.** `DB_VERSION` in `src/lib/db.ts` is the IndexedDB version. An upgrade only adds stores (`STORES_ADDED_IN`), so no record is rewritten or dropped. Once a browser has opened version N, older code that asks for version N − 1 gets a `VersionError`: until the page loads newer code, the study and Me features can neither read nor save progress (the pages that list saved data show the storage notice, never "nothing saved"), and the data stays intact. So a deploy is never rolled back past a `DB_VERSION` bump. Roll forward instead: revert the faulty change in a new commit, keep `DB_VERSION` and the stores it added, and deploy. While an upgrade waits for a tab that still runs older code, every page that needs the database asks the learner to close the other atlas tabs (`blocked`). The browser sends `blocked` only to the request at the head of its queue, so `db()` also reports it when an open has not settled after 1.5 s (`BLOCKED_AFTER_MS`); when a new service worker is waiting, the notice points to the Reload of the update notice, which reloads the older tabs that show it. A tab that holds up a newer version closes its connection and offers a reload (`blocking`). The database notice and the update notice sit in one fixed column at the bottom, so neither covers the other; the database notice can be dismissed (its button or Escape), the update notice with Later, and the column adds its height to `scroll-padding-bottom` and the footer (`--notice-h`), so neither hides the focused control. Import checks the whole file before writing anything (`checkExport` in `src/lib/import-check.ts`, which only the data page loads): the app, version and checksum of the file, then each record, which must carry an id, a timestamp and every field the study tools read (`isImportable`; a tombstone needs only the first two). A record that fails is left out and counted, and the learner is told how many, so one damaged record never blocks the rest of a backup. The oral simulator lists any stored session it cannot read, and marks a session with unreadable answers, so the learner can delete just that session.

Service-worker strategies:
- App shell is precached.
- Navigations are network-first with an offline fallback page.
- Hashed `/_astro/*` assets are cache-first.
- Study data (`/<lang>/data/*.json`) is network-first: packs hold it under the same names in every deploy, so it is served from a pack only offline.
- Offline packs are cache-first, only when the pack is installed.

The cache name includes the precache hash, so a new deploy replaces the shell atomically. Old caches are deleted on activate.

## 6. Hosting and deployment

- GitHub Pages project site. `astro.config`:
  - `site: 'https://<user>.github.io'`, `base: '/<repo>'` (exact form verified for project sites).
  - With a custom domain or a `<user>.github.io` repo, `base` is dropped.
- All internal URLs go through one `url()` helper that prefixes `import.meta.env.BASE_URL`, and Pagefind's `baseUrl` uses the same value. A test fails on any hard-coded root-relative link.
- Workflow `ci.yml`:
  - **`test` job** (push and PR), using `actions/checkout@v7` and `actions/setup-node@v7`: `npm ci`, containment guard, license scan, `astro check`, content validators, build, dist validators, Playwright, Lighthouse assertions.
  - **`deploy` job** (main only, `needs: test`): `withastro/action@v6` then `actions/deploy-pages@v5`.
  - Every `uses:` line names a full commit SHA, with its version in a comment (checked with `git ls-remote` on 2026-11-04 and again on 2026-11-07: checkout v7.0.1, setup-node v7.1.0, upload-artifact v7.0.2, download-artifact v8.0.2, withastro/action v6.1.4, deploy-pages v5.0.1). A moved tag cannot change what runs with the deploy job's `pages: write` and `id-token: write`; withastro/action v6.1.4 pins the actions it calls by SHA too. To update, resolve the new tag's SHA the same way.
  - Phase 1 must verify that `withastro/action` runs our `build` script, so that Pagefind and the SW manifest are included.
- Custom `404.html` is supported by Pages. Deep links work because every route is emitted as `/path/index.html`.
- Publishing requires the owner's `gh auth login`. Tokens are never handled by the agent.

## 7. Validators (all gates fail the build)

| Gate | Stage | Spec ref |
|---|---|---|
| Containment: nothing under `reference/`, `.work/`; no PDF/EPUB/DOCX/MOBI > 100 KB; no file > 10 MB | pre-commit + CI | §1.1 |
| No-verbatim n-gram guard | pre-commit + end of each phase (local only; references absent in CI) | §1.3 |
| Zod schemas for all collections | build | §4 |
| i18n parity: both languages present for every string; same section structure and claim markers in `en.md`/`it.md`; translation freshness hash | content | §4, §10 |
| Claim ledger: every claim marker has a ledger row; no `contradicted` in published content; `not-found-in-reference` has a second source; numbers carry claim markers | content | §1.5–1.6 |
| Citation check: DOIs/PMIDs resolve on Crossref/PubMed (cached results committed) | content (network, scheduled) | §1.6 |
| Image metadata completeness; BY-SA requires `ownerApproved: true`; `patientIdentifiable: false` | content | §2.1 |
| Relations: unknown targets, self-links, contradictory directed pairs; symmetric mirroring | content | §3.4 |
| ≥ 3 lenses per entity (A–Z not counted) | content | §3.2 |
| Navigation graph on `dist/`: no orphans, no dead ends, ≤ 3 taps from Home via a lens, hop-distance report, broken links and anchors | dist | §3.6 |
| Privacy: zero third-party requests, no cookies (Playwright); no external URLs in `src=`/`href=` of built assets except outbound citation links | e2e + dist | §2.5 |
| Size budget: total `dist/` < 400 MB; images loaded by a card with at most 3 images ≤ 450 kB; per-page JS budget (content pages ≤ 50 KB gz, study pages ≤ 120 KB gz) | dist | §6 |
| Accessibility: axe on every template at 5 viewports; keyboard traversal; focus-not-obscured test | e2e | §3.1, §8 |
| Lighthouse mobile ≥ 90 on Performance, Accessibility, Best Practices, SEO (sample pages) | e2e | §6 |
| Dependency licenses on allowlist; compatibility report | CI | §2.1 |

## 8. Performance and size budgets

- **JS:** content pages ship only small islands (≤ 50 KB gz). Study tools load ts-fsrs and idb only on study routes.
- **Images:** per image, one AVIF of 960 px for every page, a 640 px WebP for browsers without AVIF (also used by the study tools), and an AVIF at the original width that only the zoom viewer fetches, for originals wider than 1200 px. D026 was decided by measurement on 2026-11-12: [IMAGE_ENCODING.md](IMAGE_ENCODING.md).
  - Measured 2026-11-13 (26 cards): 189 kB per image in `dist/` (177 raster images, 32.7 MB), a card loads 493 kB of images by default (max 768 kB), every card has 6 to 9 images, so the 450 kB cap for cards with at most 3 images (`tests/dist/image-weight.test.ts`) checks none today. Estimate at 404 cards: about 508 MB of images, over the 400 MB total. Which numbers are measured and which estimated: `IMAGE_ENCODING.md`, "Result and projection".
  - Cold-build cost: AVIF effort 3 (`astro.config.mjs`), because sharp's default effort 4 took about 4 times as long for the same bytes (249 s against 57 s of CPU, 205 files).
- **HTML** (plan I-6): `node scripts/html-weight.mjs` prints what the bytes are made of; `tests/dist/html-weight.test.ts` holds the limits.
  - Measured 2026-11-12 on 26 cards in both languages: a card page weighs a median of 95 kB (78–104 kB, plus about 27 kB for each pathway it embeds). Before the diet: 115 kB (90–153 kB).
  - Measured 2026-11-13 on 52 card pages (V2.2 content): median 129 kB, maximum 165.9 kB, gzip median 30 kB. The markup (total minus visible text) fits 57.2 kB + 2.13 kB per image panel, residuals −7 to +11 kB.
  - Limits: card page ≤ visible text + 66 kB + 2.2 kB per image panel (`data-panel=`) + 28 kB per embedded pathway (measured 27 kB), so content growth does not fail the test and markup bloat does; pattern page ≤ 91 kB (measured 86 kB); pathway page ≤ 56 kB (measured 53 kB). Where there is no plan target, the limit is the measured maximum plus 5 %.
  - The diet (D072), on a card with 15 lens terms, 127 → 103 kB: the lens contexts as JSON instead of `<template>`s (22 kB → 2.8 kB), the claim markers (2.4 kB), the chapter index once instead of twice (2.7 kB), the card ids in `data-cards` (1 kB), shorter coordinates in the image viewer.
  - Left alone: about 12 kB of inline CSS on every card page (Astro inlines the small stylesheets; as files they would save about 10 MB at 808 pages but add render-blocking requests, and the brief keeps the inline CSS that prevents layout shift), and about 1.6 kB per image of the same viewer tool buttons and help text.
  - **Estimate at 404 cards, 2 languages (808 card pages).** A fit to the 52 pages built today (±3 kB), not a measurement: about 66 kB of page structure + 13 bytes per word of card text + 3.3 kB per image + **90 bytes per published card**, because the chapter index in the sidebar lists every published card.
    - A card at the cap (1,200 English words, about 1,380 Italian, 3 images): 91 kB (en) and 94 kB (it) with 26 cards, **125 and 128 kB with 404, over the 110 kB limit**. About 100 MB of card HTML in all. The index alone is then about 36 kB on every card page. The limit holds to about 60 more cards. Cards of 800 or 500 words are 5–9 kB lighter, which does not change the picture.
    - To stay under 110 kB at 404 cards the index must not list every card: with only the current chapter's cards (about 5 kB, with the names of the other chapters) a card page is about 94–97 kB and the card HTML about 77 MB. That changes NAVIGATION_SPEC §6 and is the owner's decision.
    - A–Z (74 kB at 26 cards) and the lens-term pages also grow with the cards; they are not projected here.
- **Caching:** filenames are content-hashed. GitHub Pages does not offer custom cache headers (verify in Phase 1), so the service worker's cache-first strategy provides long-lived caching for returning users.

## 9. Operations

Traffic-risk mitigations (no paid services) are documented in `docs/OPERATIONS.md` in Phase 5:
- SW caching to cut repeat bandwidth.
- Opt-in packs instead of precaching everything.
- Image budgets.
- A documented, not-enabled mirror plan if the 100 GB/month soft limit is approached.
