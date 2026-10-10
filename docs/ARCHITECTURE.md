# Architecture

Status: PHASE 0 proposal, 2026-10-10. Versions come from [VERIFIED_FACTS.md](VERIFIED_FACTS.md) (checked the same day). Deviations from the brief are justified in [DECISIONS.md](DECISIONS.md).

## 1. Constraints that shape everything

| Constraint | Consequence |
|---|---|
| Free, no login, no trackers, no cookies, user data on device | Fully static site; all personal state in IndexedDB; zero third-party requests (tested). |
| GitHub Pages: site ≤ 1 GB, deploy ≤ 10 min, soft 100 GB/month, public repo on Free plan | Our own hard budget is **< 300 MB built site** (brief), enforced in CI; images are the main cost. |
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
| Images | `astro:assets` + sharp | sharp 0.35.5 | AVIF/WebP, responsive `srcset`, lazy loading. |
| Search | Pagefind | 1.5.2 | Post-build; one index per `<html lang>`; diacritic-tolerant since 1.5.0; `baseUrl` for project-site subpath. |
| Spaced repetition | ts-fsrs | 5.4.2 (MIT, Node ≥ 20) | FSRS v6 scheduler. |
| Client storage | idb (IndexedDB wrapper) | 8.0.4 (ISC) | |
| Service worker | Hand-written, plus a build script that emits the precache list | — | `@vite-pwa/astro` does not support Astro 6/7 (D006). |
| Sitemap | `@astrojs/sitemap` | 3.7.4 | With i18n alternates. |
| Unit + content validators | Vitest | 5.0.3 | Validators are Vitest suites (D014). |
| E2E, a11y | Playwright + `@axe-core/playwright` | 1.64.0 / 4.13.0 | Chromium, Firefox, WebKit. axe is MPL-2.0, dev-only and not shipped. |
| Performance audit | `lighthouse` CLI + small assertion script | 13.5.0 | `@lhci/cli` not used: no release since 2025-06 (D007). |
| License scan | license-checker-rseidelsohn | 5.0.1 | Needs Node ≥ 24, npm ≥ 11. |
| Git hooks | simple-git-hooks | 2.14.0 | Pre-commit containment and no-verbatim guard. |
| Reference text extraction (guard) | pdfjs-dist | verify in Phase 1 | Apache-2.0, in-repo. PyMuPDF (AGPL) was used only for Phase 0 exploration, outside the repo (D016). |
| Fonts | Fraunces (display) + Atkinson Hyperlegible Next (body), self-hosted via `@fontsource-variable/*` | 5.3.0 / 5.3.0 (OFL-1.1) | Bundled with the site, no third-party requests (D015 revised). |

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

Service-worker strategies:
- App shell is precached.
- Navigations are network-first with an offline fallback page.
- Hashed `/_astro/*` assets are cache-first.
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
| Size budget: total `dist/` < 300 MB; per-page JS budget (content pages ≤ 50 KB gz, study pages ≤ 120 KB gz) | dist | §6 |
| Accessibility: axe on every template at 5 viewports; keyboard traversal; focus-not-obscured test | e2e | §3.1, §8 |
| Lighthouse mobile ≥ 90 on Performance, Accessibility, Best Practices, SEO (sample pages) | e2e | §6 |
| Dependency licenses on allowlist; compatibility report | CI | §2.1 |

## 8. Performance and size budgets

- **JS:** content pages ship only small islands (≤ 50 KB gz). Study tools load ts-fsrs and idb only on study routes.
- **Images:** the default is AVIF + WebP at 2 widths. If the measured Phase 2 average puts the projected full-scope total above budget, drop to AVIF-only plus the smallest WebP fallback (D026, decided by measurement).
  - Rough budget: ≤ 220 MB of the 300 MB for images, i.e. ~110 KB per image at 2,000 images.
  - CI prints the per-module image cost.
- **HTML:** ~2 languages × (~1,190 entities + ~16 pattern pages + lens/term pages + tools) ≈ 3,000–3,500 pages. Text weight is negligible next to images.
- **Caching:** filenames are content-hashed. GitHub Pages does not offer custom cache headers (verify in Phase 1), so the service worker's cache-first strategy provides long-lived caching for returning users.

## 9. Operations

Traffic-risk mitigations (no paid services) are documented in `docs/OPERATIONS.md` in Phase 5:
- SW caching to cut repeat bandwidth.
- Opt-in packs instead of precaching everything.
- Image budgets.
- A documented, not-enabled mirror plan if the 100 GB/month soft limit is approached.
