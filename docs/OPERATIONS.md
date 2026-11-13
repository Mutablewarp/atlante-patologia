# Operations

How the site is hosted, what limits apply, and what to do if traffic grows. Facts about GitHub Pages come from [VERIFIED_FACTS.md](VERIFIED_FACTS.md) §C (checked 2026-10-10 on docs.github.com); re-check them before relying on a number.

## Hosting

- **Where:** GitHub Pages project site, <https://mutablewarp.github.io/atlante-patologia/>, built and deployed by `.github/workflows/ci.yml` (`withastro/action` + `actions/deploy-pages`) on every push to `main`, after the test, e2e and Lighthouse jobs pass.
- **Settings:** repository **Settings → Pages → Source: GitHub Actions**. The repository must stay public on GitHub Free.
- **Labels for the issue forms:** create `content-error`, `takedown`, `accessibility` and `translation` once (GitHub ignores labels that do not exist).
- **Visitor data:** GitHub logs visitor IP addresses for security. The site sets no cookies and makes no third-party requests (proved by `tests/e2e/privacy.spec.ts`); the privacy page discloses the GitHub logging.

## GitHub Pages limits

| Limit | Value | Where we stand |
|---|---|---|
| Published site size | ≤ 1 GB | Budget: `dist/` < 400 MB (300 MB until decision D8 of the V3 plan), enforced by `tests/dist/budget.test.ts` (2026-11-12: about 31 MB, 26 cards) |
| Source repository | 1 GB recommended | Images are committed once in source form; no build output, no reference material (containment guard) |
| Bandwidth | Soft limit 100 GB per month | See mitigations below |
| Deployment | Times out after 10 minutes | Build takes well under a minute today |
| Builds | Soft 10 per hour, but not for custom Actions workflows (ours) | — |
| Rate limiting | Excess traffic may get HTTP 429 | Static files only; nothing retries automatically |
| Use | No commercial hosting, e-commerce or SaaS; no passwords or payment data | Free, ad-free, no accounts |

GitHub Pages does not let us set cache headers, so long-lived caching for returning visitors will come from the service worker (ARCHITECTURE §8).

## Bandwidth mitigations (no paid services)

1. **Image budget:** one AVIF per image for every page, a small WebP fallback, and an AVIF at the original width that only the zoom viewer fetches: about 172 KB per image in `dist/`, and at most 450 KB of images loaded by a card page with up to 3 images (ARCHITECTURE §8, D026, [IMAGE_ENCODING.md](IMAGE_ENCODING.md)). Images are by far the largest share of the bytes.
2. **Load on demand:** the search index loads only on the search page and study code only on study pages (JS budgets in `tests/dist/budget.test.ts`); images use `loading="lazy"` and `decoding="async"`, and the zoom file is fetched only when a learner zooms.
3. **Service worker (planned):** cache-first for hashed assets, so a returning student downloads a page's assets once.
4. **Opt-in offline packs (planned):** whole chapters are downloaded only when a student asks, never precached for everyone.
5. **Measure before acting:** GitHub does not give Pages traffic numbers for bandwidth. Watch for HTTP 429 reports in issues and for a notice from GitHub; the repository's Insights → Traffic shows repository views, not site bandwidth.

## Mirror plan (documented, **not enabled**)

Only if GitHub asks us to reduce traffic, or 429 errors become frequent:

1. Build once in CI and publish the same `dist/` to a second free static host that accepts open-source, non-commercial projects (for example Cloudflare Pages or Netlify free tier; verify their current terms first). Owner decision, owner account.
2. Keep `site` and `base` in `astro.config.mjs` pointing at one canonical URL, so `canonical` and `hreflang` tags stay on the main site and search engines do not see duplicate content.
3. Announce the mirror on the About page and in the README. Do not add redirects or third-party scripts; the mirror serves the identical static files.
4. The privacy statement must then name the mirror's host and its logging.

Nothing in the build depends on the host: `dist/` is plain static files with relative-to-base URLs, so switching hosts is a deploy change, not a code change. A custom domain later is only a `site`/`base` change plus a `CNAME`.

## Routine checks

| When | What |
|---|---|
| Every push | CI: guard, type check, unit tests, license scan, build, contrast, dist validators, Playwright (3 engines), Lighthouse |
| Each phase end | `npm run no-verbatim` locally (reference texts are not in CI); re-run `npm run licenses` and commit the ledger |
| Monthly | Dependency updates (exact versions, one at a time, full gates); re-check the GitHub Pages limits page |
| Before 2026-10-19 | Done: CI runner pinned to `ubuntu-24.04` (`ubuntu-latest` moves to 26.04 that day) |
