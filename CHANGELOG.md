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
- Images: every page loads one AVIF of at most 960 px, browsers without AVIF get a small WebP, and the image viewer fetches an AVIF at the original width only when a learner zooms. The built site is 31 MB instead of 58 MB for the same 26 cards (about 172 kB per image instead of 526 kB); a card with up to 3 images loads at most 450 kB of images, and the size budget is now 400 MB. See `docs/IMAGE_ENCODING.md`.
- CI runner pinned to `ubuntu-24.04`; deploy waits for e2e and Lighthouse.
- The language switch keeps the current `?query` and `#hash`.
- Smoother Italian in several interface strings.

### Fixed
- Sitemap no longer lists the root language picker as an Italian page and uses the same language codes as the `hreflang` tags.
- The 404 page has no canonical link to a non-existent URL, and its language switch says it leads to the other language's home page.
- Search shows “1 risultato” / “1 result” for a single match.
- Reading list no longer prints “et al..”.
