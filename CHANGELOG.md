# Changelog

All notable changes to this project are listed here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow [Semantic Versioning](https://semver.org/) once the first chapter is published.

## [Unreleased]

### Added
- Phase 1 foundation: Astro 7 static site in Italian and English with the five-destination navigation (bottom bar, rail, sidebar), six atlas lenses, A–Z index, self-hosted Pagefind search, About section (method, disclaimer, privacy, accessibility, licenses, credits, reading list, roadmap, report), bilingual 404 and a root language picker.
- Content schemas, relation and lens helpers, containment guard, no-verbatim guard and contrast check.
- Dist validators (`npm run test:dist`): navigation graph (no orphans, no dead ends, ≤ 3 steps to every entity through a lens, hop report), links and anchors, base-path check, size and JavaScript budgets, no external assets.
- Playwright suites on Chromium, Firefox and WebKit at 5 viewports: axe (light and dark), keyboard and focus visibility, navigation layout and target sizes, privacy (same-origin requests only, no cookies), language entry and switch.
- Lighthouse gate (mobile, ≥ 90 in all four categories) and dependency license ledger (`docs/licenses/`).
- Issue forms (content error, takedown, accessibility, translation), pull request template, contributing guide, code of conduct and operations notes.

### Changed
- CI runner pinned to `ubuntu-24.04`; deploy waits for e2e and Lighthouse.
- Card pages are about 17 % lighter (median 115 → 95 kB of HTML): the lens contexts are JSON read in the browser instead of 30 `<template>`s, the claim markers and the second copy of the chapter index are gone from the built HTML. `node scripts/html-weight.mjs` shows what a page is made of; `tests/dist/html-weight.test.ts` holds the budgets: a card page may weigh its visible text + 66 kB + 2.2 kB per image panel + 28 kB per embedded pathway, so longer cards pass and heavier markup fails (measured 2026-11-13 on 52 card pages: median 129 kB, maximum 165.9 kB, gzip median 30 kB). The figures are raw HTML (the size in the offline cache), not the transfer size; the report also prints a gzip median.
- The language switch keeps the current `?query` and `#hash`.
- Smoother Italian in several interface strings.

### Fixed
- Sitemap no longer lists the root language picker as an Italian page and uses the same language codes as the `hreflang` tags.
- The 404 page has no canonical link to a non-existent URL, and its language switch says it leads to the other language's home page.
- Search shows “1 risultato” / “1 result” for a single match.
- Reading list no longer prints “et al..”.
