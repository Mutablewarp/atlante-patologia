# Verified External Facts (Phase 0)

Checked on 2026-10-10 by an AI agent; re-verify before relying on it.

Notes on method: npm facts come from `npm view <pkg> version engines peerDependencies license time --json` run on 2026-10-10. "Published" is `time[<latest version>]`, i.e. the publish date of the current `latest` dist-tag. GitHub release tags come from `https://api.github.com/repos/<owner>/<repo>/releases/latest`. Wording summaries are paraphrases unless in quotation marks.

## A. npm packages and Node.js

| Fact | Value | Source (URL or command) | Checked |
|---|---|---|---|
| astro | 7.3.8; MIT; engines node `>=22.12.0`, npm `>=9.6.5`; peer `@astrojs/markdown-remark ^7.3.0`; deps include `vite ^8.3.1`, `zod ^4.6.5`; published 2026-10-08 (beta tag 7.4.0-beta.1) | `npm view astro ...` | 2026-10-10 |
| @astrojs/preact | 6.0.6; MIT; node `>=22.12.0`; peer `preact ^10.6.5`; depends on `@preact/signals ^2.11.2`, `vite ^8.3.0`; published 2026-10-06 | `npm view @astrojs/preact ...` | 2026-10-10 |
| preact | 11.0.1; MIT; peer `preact-render-to-string >=6.7.0`; published 2026-10-08. **Conflict:** @astrojs/preact 6.0.6 peer range is `^10.6.5`, so Preact 11 is outside the declared range; pin `preact@^10` unless the integration is updated | `npm view preact ...` | 2026-10-10 |
| @preact/signals | 2.11.3; MIT; peer `preact >= 10.25.0 \|\| >=11.0.0-0`; published 2026-09-30 | `npm view @preact/signals ...` | 2026-10-10 |
| @astrojs/svelte | 9.0.1; MIT; node `>=22.12.0`; peers `astro ^7.0.0`, `svelte ^5.43.6`, `typescript ^5.3.3 \|\| ^6.0.0`; published 2026-07-01 | `npm view @astrojs/svelte ...` | 2026-10-10 |
| svelte | 5.57.2; MIT; node `>=18`; published 2026-10-06 | `npm view svelte ...` | 2026-10-10 |
| @astrojs/sitemap | 3.7.4; MIT; no engines field; deps `zod ^4.3.6`, `sitemap ^9.0.0`; published 2026-08-31 | `npm view @astrojs/sitemap ...` | 2026-10-10 |
| pagefind | 1.5.2; MIT; no engines field; native binaries via optionalDependencies (`@pagefind/darwin-arm64`, `linux-x64`, `windows-x64`, ...); published 2026-04-12 | `npm view pagefind ...` | 2026-10-10 |
| ts-fsrs | 5.4.2; MIT; node `>=20.0.0`; ESM (`"type":"module"`) with CJS + UMD exports; published 2026-09-01 (beta tag 6.0.0-beta.14) | `npm view ts-fsrs ...` | 2026-10-10 |
| idb | 8.0.4; ISC; no engines; published 2026-10-06 | `npm view idb ...` | 2026-10-10 |
| zod | 4.6.5; MIT; no engines; published 2026-09-13 | `npm view zod ...` | 2026-10-10 |
| @vite-pwa/astro | 1.2.0; MIT; peers `astro ^1.6.0 \|\| ^2 \|\| ^3 \|\| ^4 \|\| ^5.0.0`, `vite-plugin-pwa ^1.2.0`, optional `@vite-pwa/assets-generator ^1.0.0`; published 2025-11-27 (see section F) | `npm view @vite-pwa/astro ...` | 2026-10-10 |
| vite-plugin-pwa | 2.0.0; MIT; node `>=20.19.0`; peers `vite ^3.1.0 ... \|\| ^8.0.0`, `workbox-build ^7.4.1`, `workbox-window ^7.4.1`; published 2026-10-03 | `npm view vite-plugin-pwa ...` | 2026-10-10 |
| workbox-window | 7.4.1; MIT; published 2026-05-04 | `npm view workbox-window ...` | 2026-10-10 |
| @playwright/test | 1.64.0; Apache-2.0; node `>=20`; published 2026-10-07 | `npm view @playwright/test ...` | 2026-10-10 |
| @axe-core/playwright | 4.13.0; **MPL-2.0**; peer `playwright-core >= 1.0.0`; published 2026-08-11 | `npm view @axe-core/playwright ...` | 2026-10-10 |
| @lhci/cli | 0.15.1; Apache-2.0; no engines; published 2025-06-25 (no release in ~15 months) | `npm view @lhci/cli ...` | 2026-10-10 |
| vitest | 5.0.3; MIT; node `^22.12.0 \|\| ^24.0.0 \|\| >=26.0.0`; peer `vite ^6.4.0 \|\| ^7 \|\| ^8`; published 2026-09-30 | `npm view vitest ...` | 2026-10-10 |
| typescript | 7.0.2; Apache-2.0; node `>=16.20.0`; published 2026-07-08. **Conflict:** `@astrojs/svelte` peer is `^5.3.3 \|\| ^6.0.0` and `@astrojs/check` 0.9.10 peer is `^5.0.0 \|\| ^6.0.0`; TS 7 is outside both ranges | `npm view typescript ...`; `npm view @astrojs/check version peerDependencies` | 2026-10-10 |
| simple-git-hooks | 2.14.0; MIT; no engines; published 2026-08-28 | `npm view simple-git-hooks ...` | 2026-10-10 |
| license-checker-rseidelsohn | 5.0.1; BSD-3-Clause; engines node `>=24`, npm `>=11`; published 2026-05-27 (next tag 6.0.0-rc.1). Not stale, so no alternative scanner was evaluated | `npm view license-checker-rseidelsohn ...` | 2026-10-10 |
| sharp | 0.35.5; Apache-2.0; node `>=20.9.0`; published 2026-09-27 | `npm view sharp ...` | 2026-10-10 |
| Node.js Active LTS major | **v24 "Krypton"**; latest in line **v24.21.0** (2026-09-07). v24 enters Maintenance on 2026-10-20 | `curl https://nodejs.org/dist/index.json`; `https://raw.githubusercontent.com/nodejs/Release/main/schedule.json` | 2026-10-10 |
| Next LTS | v26 (current v26.11.1, 2026-10-07) is scheduled to become LTS on 2026-10-28. v22 "Jod" (v22.23.3) is in Maintenance until 2027-04-30 | same as above | 2026-10-10 |

## B. Astro official docs (docs.astro.build)

| Fact | Value | Source (URL or command) | Checked |
|---|---|---|---|
| Minimum Node for Astro 7 | "v22.12.0 or higher. Odd-numbered versions like v23 are not supported." (matches npm engines `>=22.12.0`) | https://docs.astro.build/en/install-and-setup/ | 2026-10-10 |
| i18n config keys | `i18n: { locales: ["it","en"], defaultLocale: "<it or en>", routing: { prefixDefaultLocale: true, redirectToDefaultLocale: <bool>, fallbackType } }`; optional `fallback`, `domains` | https://docs.astro.build/en/guides/internationalization/ | 2026-10-10 |
| `prefixDefaultLocale` | boolean, default `false`, since astro@3.7.0. With `true`, all URLs including the default locale get a `/[locale]/` prefix; default-locale pages go in `src/pages/<defaultLocale>/`; unprefixed URLs return 404 unless a fallback is set | guide above + https://docs.astro.build/en/reference/configuration-reference/ | 2026-10-10 |
| `redirectToDefaultLocale` | boolean, default `false`, since astro@4.2.0. With `prefixDefaultLocale: true`, setting it to `true` makes the home URL `/` generated by `src/pages/index.astro` redirect to `/[defaultLocale]/`. With `false`, `/` is served by `src/pages/index.astro` as a page outside the locale structure | configuration reference (i18n.routing.redirectToDefaultLocale) + guide section "Opting out of redirects for the home URL" | 2026-10-10 |
| Root `/` with prefixed locales | File tree in guide marks `src/pages/index.astro` as "this file is always required" when `prefixDefaultLocale: true` | guide above (docs source `src/content/docs/en/guides/internationalization.mdx`, line ~159) | 2026-10-10 |
| Redirect mechanism in static output | General rule (config reference, `redirects`): for statically generated sites with no adapter, Astro produces a client redirect using a `<meta http-equiv="refresh">` tag and does not support status codes. The i18n pages do not state the mechanism for the `/` redirect explicitly (see "Could not verify") | https://docs.astro.build/en/reference/configuration-reference/ (`redirects`); routing guide | 2026-10-10 |
| `fallbackType` | `"redirect" \| "rewrite"`, default `"redirect"`, since astro@4.15.0 | configuration reference | 2026-10-10 |
| Locale helpers | `Astro.currentLocale` is available on all pages including static prerendered ones; `getRelativeLocaleUrl()` from `astro:i18n` | i18n guide | 2026-10-10 |
| Content collections config file | `src/content.config.ts` (`.js`/`.mjs` also allowed); live collections use `src/live.config.ts` | https://docs.astro.build/en/guides/content-collections/ | 2026-10-10 |
| Loaders | `import { glob, file } from 'astro/loaders';` | same | 2026-10-10 |
| `z` import | `import { z } from 'astro/zod';` (docs examples do not import `z` from `astro:content`) | same | 2026-10-10 |
| Zod version | Docs say Astro's `z` "supports all of the features of Zod 4"; astro 7.3.8 depends on `zod ^4.6.5` | same + `npm view astro dependencies` | 2026-10-10 |
| Query API | `getCollection`, `getEntry`, `getEntries`, `render` from `astro:content` | same | 2026-10-10 |
| GH Pages guide action versions | `actions/checkout@v7`, `withastro/action@v6`, `actions/deploy-pages@v5` | https://docs.astro.build/en/guides/deploy/github/ | 2026-10-10 |
| withastro/action Node default | "Defaults to 24"; package manager detected from the committed lockfile | same | 2026-10-10 |
| `site` + `base` for project site | `site: 'https://<username>.github.io'`, `base: '/<repo-name>'` (example: `site: 'https://astronaut.github.io'`, `base: '/my-repo'`). `base` can be omitted only if the repo is named `<username>.github.io` | same | 2026-10-10 |

## C. GitHub docs (docs.github.com) and action releases

| Fact | Value | Source (URL or command) | Checked |
|---|---|---|---|
| Published site size | "Published GitHub Pages sites may be no larger than 1 GB." | https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits | 2026-10-10 |
| Source repo size | Recommended limit of 1 GB | same | 2026-10-10 |
| Deployment timeout | Deployments time out after 10 minutes | same | 2026-10-10 |
| Bandwidth | Soft limit of 100 GB per month | same | 2026-10-10 |
| Build rate | Soft limit of 10 builds per hour; "This limit does not apply if you build and publish your site with a custom GitHub Actions workflow." | same | 2026-10-10 |
| Rate limiting | Excess traffic may get HTTP 429 responses | same | 2026-10-10 |
| Artifact size | `upload-pages-artifact`: gzip archive containing one tar file, tar must be under 10 GB, no symbolic or hard links | https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages | 2026-10-10 |
| Pages on GitHub Free | Free personal plan includes "GitHub Pages in public repositories". "If the account that owns the repository uses GitHub Free or GitHub Free for organizations, the repository must be public." Pages from private repos is listed under GitHub Pro and GitHub Team (checked); the published site is still public. Private (access-controlled) Pages need an org on GitHub Enterprise Cloud | https://docs.github.com/en/get-started/learning-about-github/githubs-plans ; https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site | 2026-10-10 |
| Prohibited uses | Pages is not intended for or allowed to be used as free web hosting to run an online business, e-commerce site, or any site primarily directed at facilitating commercial transactions or providing commercial SaaS. Not to be used for sensitive transactions such as sending passwords or credit card numbers | github-pages-limits page (section "Prohibited uses") | 2026-10-10 |
| Visitor data | Visitor IP addresses are logged and stored for security purposes | https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages | 2026-10-10 |
| Custom 404 | Supported: add `404.html` (or `404.md` with front matter `permalink: /404.html`) to the publishing source | https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-custom-404-page-for-your-github-pages-site | 2026-10-10 |
| actions/checkout | latest v7.0.1 (2026-07-20) → use `@v7` | `curl https://api.github.com/repos/actions/checkout/releases/latest` | 2026-10-10 |
| actions/upload-pages-artifact | latest v5.0.0 (2026-04-10) → `@v5` | same API, actions/upload-pages-artifact | 2026-10-10 |
| actions/deploy-pages | latest v5.0.1 (2026-09-01) → `@v5` | same API, actions/deploy-pages | 2026-10-10 |
| actions/setup-node | latest v7.1.0 (2026-10-08) → `@v7` | same API, actions/setup-node | 2026-10-10 |
| actions/configure-pages | latest v6.0.0 (2026-03-25) → `@v6` | same API, actions/configure-pages | 2026-10-10 |
| withastro/action | latest v6.1.3 (2026-09-14) → `@v6` | same API, withastro/action | 2026-10-10 |
| GitHub docs examples lag | The "custom workflows" page still shows `upload-pages-artifact@v4`, `deploy-pages@v4`, `configure-pages@v5` (older than the latest releases above) | using-custom-workflows-with-github-pages page | 2026-10-10 |

## D. Pagefind (pagefind.app)

| Fact | Value | Source (URL or command) | Checked |
|---|---|---|---|
| Current version | 1.5.2 (npm `latest`; GitHub release v1.5.2, 2026-04-12). 1.5.0 introduced a web-component "Component UI" that replaces the Default UI | `npm view pagefind`; GitHub releases API; https://pagefind.app/docs/node-api/ | 2026-10-10 |
| Multilingual | Reads `<html lang>`; indexes each language separately (one index per language); in the browser it reads the same `lang` and loads the matching index. `forceLanguage` opts out and builds one index for the whole site | https://pagefind.app/docs/multilingual/ | 2026-10-10 |
| Italian | `it` listed with UI translations and word stemming | same | 2026-10-10 |
| Languages with stemming | Arabic, Armenian, Basque, Catalan, Danish, Dutch, English, Estonian, Finnish, French, German, Greek, Hindi, Hungarian, Indonesian, Irish, Italian, Lithuanian, Nepali, Norwegian, Polish, Portuguese, Romanian, Russian, Serbian, Spanish, Swedish, Tamil, Turkish, Yiddish (no stemming for Chinese, Japanese, Korean) | same | 2026-10-10 |
| Diacritics | Since 1.5.0, matching works across diacritics (e.g. "cafe" finds "café"); exact diacritic matches rank higher by default. `exactDiacritics: true` (default `false`) treats accented letters as distinct | https://pagefind.app/docs/search-config/ ; CHANGELOG.md in github.com/Pagefind/pagefind | 2026-10-10 |
| Filters | `data-pagefind-filter="key"` (element text), `"key[attr]"` (attribute value), `"key:value"` (inline, must come last). Reserved keys: `any`, `all`, `none`, `not`. Query: `pagefind.search("term", { filters: { author: "X" } })` with compound `any`/`all`/`none`/`not` | https://pagefind.app/docs/filtering/ ; https://pagefind.app/docs/js-api-filtering/ | 2026-10-10 |
| Metadata | `data-pagefind-meta` with same three syntaxes; one value per key; automatic `title` (first `h1`) and `image` (first `img` after `h1`, plus `image_alt`) | https://pagefind.app/docs/metadata/ | 2026-10-10 |
| Node indexing API | `import * as pagefind from "pagefind"`; `pagefind.createIndex(config?)` → `index.addDirectory({path, glob?})`, `index.addHTMLFile({sourcePath\|url, content})`, `index.addCustomRecord({url, content, language, meta?, filters?, sort?})`, `index.writeFiles({outputPath})`, `index.getFiles()`, `index.deleteIndex()`, `pagefind.close()`; config includes `rootSelector`, `excludeSelectors`, `forceLanguage`, `keepIndexUrl` | https://pagefind.app/docs/node-api/ | 2026-10-10 |
| Base path option | Search config `baseUrl` (default `/`) for sites hosted on a subpath; `bundlePath` (`basePath` in the JS API) | https://pagefind.app/docs/search-config/ | 2026-10-10 |

## E. ts-fsrs (github.com/open-spaced-repetition/ts-fsrs)

| Fact | Value | Source (URL or command) | Checked |
|---|---|---|---|
| Version | 5.4.2 (npm latest; GitHub release v5.4.2, 2026-09-01); 6.0.0-beta.14 on `beta` tag | `npm view ts-fsrs`; GitHub releases API | 2026-10-10 |
| License | MIT | npm + GitHub repo API | 2026-10-10 |
| Node engine | `>=20.0.0` (README: Node 16 and 18 no longer supported) | npm engines; README.md | 2026-10-10 |
| Algorithm | Implements FSRS v6 | README.md package table | 2026-10-10 |
| API names | `createEmptyCard()`, `fsrs(params?)`, `generatorParameters(partial)`, `scheduler.repeat(card, now)` (preview all 4 ratings), `scheduler.next(card, now, Rating.Good)` (apply one), `Rating.Again/Hard/Good/Easy`, `State.New/Learning/...`, `rollback(card, log)`, `forget(card, now, reset_count?)`, `forgetting_curve()`, `next_state()`, `next_interval()`; params include `request_retention`, `maximum_interval`, `enable_fuzz` | packages/fsrs/README.md (raw.githubusercontent.com) | 2026-10-10 |
| Repo status | Not archived; last push 2026-10-10 | `curl https://api.github.com/repos/open-spaced-repetition/ts-fsrs` | 2026-10-10 |

## F. @vite-pwa/astro

| Fact | Value | Source (URL or command) | Checked |
|---|---|---|---|
| Last release | v1.2.0 on 2025-11-27; last commit 2025-11-27; repo not archived; 13 open issues | GitHub API `repos/vite-pwa/astro/releases`, `/commits`, repo | 2026-10-10 |
| Astro peer range | `^1.6.0 \|\| ^2 \|\| ^3 \|\| ^4 \|\| ^5.0.0` → **does not include Astro 6 or 7** (current 7.3.8) | `npm view @vite-pwa/astro peerDependencies` | 2026-10-10 |
| vite-plugin-pwa range | Depends on and peers `vite-plugin-pwa ^1.2.0` → **does not include vite-plugin-pwa 2.0.0** | same | 2026-10-10 |
| Open issues | #72 "Astro 6 peer dependency range blocks installation" (opened 2026-03-11, open); #74 "Astro 7 support" (opened 2026-07-11, open, 0 comments) | GitHub search API, repo:vite-pwa/astro | 2026-10-10 |
| Maintenance verdict | Effectively unmaintained for current Astro: no release in ~10 months and no Astro 6/7 support. Using it with Astro 7 would require overriding peer deps (untested). Consider `vite-plugin-pwa` 2.0.0 directly (peers `vite ^8`, which Astro 7 uses) or a hand-written service worker | inference from rows above | 2026-10-10 |
| injectManifest | Docs page for the Astro integration gives `injectManifest`-specific instructions (navigation fallback for 404, `directoryIndex`, optional `cleanURLs`), so the strategy is supported by the integration | https://vite-pwa-org.netlify.app/frameworks/astro.html | 2026-10-10 |

## G. WebKit / Safari storage

| Fact | Value | Source (URL or command) | Checked |
|---|---|---|---|
| 7-day cap (2020) | Blog "Full Third-Party Cookie Blocking and More", 2020-03-24, shipped in iOS/iPadOS 13.4 and Safari 13.1 (macOS). All script-writable storage (IndexedDB, LocalStorage, media keys, SessionStorage, Service Worker registrations and cache) is deleted after seven days of Safari use without user interaction on the site | https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/ | 2026-10-10 |
| Home Screen exception | Web apps added to the Home Screen are not part of Safari and have their own counter of days of use; the counter tracks actual use of the web app, which resets the timer. WebKit does not expect first-party data of such apps to be deleted | same | 2026-10-10 |
| 2023 storage policy | Blog "Updates to Storage Policy", 2023-08-10. Applies from Safari 17.0 and WebKit apps on iOS 17, iPadOS 17, macOS Sonoma | https://webkit.org/blog/14403/updates-to-storage-policy/ | 2026-10-10 |
| Quotas | Browser apps: per-origin up to 60% of total disk, all origins up to 80%. Other apps (non-browser, e.g. WKWebView apps): per-origin up to 15%, overall up to 20%. Home Screen web apps get the browser-app quotas | same | 2026-10-10 |
| `navigator.storage.persist()` | Storage API (incl. `persist()`, `persisted()`, `estimate()`) supported from Safari 17.0. Default is best-effort mode (data can be evicted). Persistence is granted by heuristics; the blog's example heuristic is whether the site is opened as a Home Screen Web App. Origins in persistent mode (or with an active page) may be excluded from eviction | same | 2026-10-10 |
| Eviction | Per-origin (all data of an origin deleted together), least-recently-used order; last-use = last user interaction or last storage operation | same | 2026-10-10 |
| Interaction with 7-day rule | The 2023 blog does not say whether persistent mode exempts an origin from the 2020 seven-day deletion (see "Could not verify") | same | 2026-10-10 |

## H. WCAG 2.2 (w3.org)

| Fact | Value | Source (URL or command) | Checked |
|---|---|---|---|
| Document status | W3C Recommendation, 12 December 2024 version | https://www.w3.org/TR/WCAG22/ | 2026-10-10 |
| SC 2.5.8 Target Size (Minimum) | Level **AA**; targets at least **24 × 24 CSS px**; exceptions: Spacing (24 px circle test), Equivalent, Inline, User agent control, Essential | same (curl + HTML extraction) | 2026-10-10 |
| SC 2.5.5 Target Size (Enhanced) | Level **AAA**; at least **44 × 44 CSS px**; exceptions: Equivalent, Inline, User agent control, Essential | same | 2026-10-10 |
| SC 2.4.11 Focus Not Obscured (Minimum) | Level **AA**; when a component receives keyboard focus it is not entirely hidden by author-created content. Notes: only initial positions of user-movable content count; content opened by the user may obscure focus if the user can reveal it without moving focus | same | 2026-10-10 |
| SC 2.4.12 Focus Not Obscured (Enhanced) | Level AAA; no part of the focused component is hidden by author-created content | same | 2026-10-10 |

## I. Navigation guidelines

| Fact | Value | Source (URL or command) | Checked |
|---|---|---|---|
| M3 navigation bar destinations | "three to five destinations"; don't use for fewer than three (use tabs) or more than five | https://m3.material.io/components/navigation-bar/guidelines (rendered in browser) | 2026-10-10 |
| M3 navigation bar window classes | Only for compact and medium breakpoints. Compact: navigation bar or modal navigation rail. Medium: bar or rail. Expanded and larger: use a navigation rail | same | 2026-10-10 |
| M3 navigation rail window classes | For medium to extra-large breakpoints (tablets, desktop). Compact: don't use a standard rail, use a navigation bar. Medium with few destinations: consider a bar. More than five destinations: consider a modal expanded rail | https://m3.material.io/components/navigation-rail/guidelines (rendered in browser) | 2026-10-10 |
| Apple HIG tab bars count | No fixed number. "Use the appropriate number of tabs required"; fewer tabs are easier to navigate; avoid overflow (iOS/iPadOS turn the trailing tab into a More tab when space runs out). iPadOS customizable tab bars: aim for a default of five or fewer | https://developer.apple.com/design/human-interface-guidelines/tab-bars (JSON: developer.apple.com/tutorials/data/design/human-interface-guidelines/tab-bars.json) | 2026-10-10 |
| Apple HIG tab bars purpose | Use a tab bar for navigation, not actions (actions go in a toolbar); keep it visible; don't disable or hide tab buttons; include labels (single words when possible) | same | 2026-10-10 |

## J. Vercel Hobby plan

| Fact | Value | Source (URL or command) | Checked |
|---|---|---|---|
| Commercial restriction | Hobby is restricted to non-commercial, personal use only; all commercial use needs Pro or Enterprise | https://vercel.com/docs/plans/hobby (last_updated 2026-09-14); https://vercel.com/docs/limits/fair-use-guidelines#commercial-usage | 2026-10-10 |
| Definition of commercial use | Any deployment used for financial gain of anyone involved in any part of production (including a paid employee or consultant writing the code). Examples: requesting/processing payment from visitors, advertising a product or service for sale, being paid to create/update/host the site, affiliate linking as primary purpose, any advertisements (e.g. Google AdSense). Asking for donations is not commercial use | fair-use-guidelines page (last_updated 2026-09-14) | 2026-10-10 |

## K. Textbook and classification editions

| Fact | Value | Source (URL or command) | Checked |
|---|---|---|---|
| Robbins Pathologic Basis of Disease | **11th edition**, current title "Robbins, Cotran & Kumar Pathologic Basis of Disease" (not "Robbins & Kumar"); editors Kumar, Abbas, Aster, Debnath, Das; marked "Latest edition"; release date shown as **May 19, 2025** (a search snippet showed May 30, 2025); ISBN 978-0-443-26452-8 (from URL). Owner's belief "11th, 2025" confirmed | https://shop.elsevier.com/books/robbins-cotran-and-kumar-pathologic-basis-of-disease/kumar/978-0-443-26452-8 | 2026-10-10 |
| Do not confuse | "Robbins & Kumar Basic Pathology" is a separate, shorter book; its 11th edition is from 2022/2023 (ISBN 9780323790185) | Elsevier Health listings (search results) | 2026-10-10 |
| Rubin's Pathology | Latest found: **8th edition**, "Rubin's Pathology: Mechanisms of Human Disease", Strayer, Saffitz, Rubin; LWW shop date September 9, 2019 (other listings: Oct 22, 2019; library records c2020); ISBN 9781975141042 (eBook), 9781496386144. No 9th edition found | https://shop.lww.com/Rubin-s-Pathology/p/9781975141042 ; web search | 2026-10-10 |
| WHO Blue Books 5th edition | Series ran 2018–2026, 14 volumes. IARC catalogue lists all 14, the last ones: Vol. 12 Skin (2025), Vol. 13 Eye and Orbit (2026), Vol. 14 Genetic Tumour Syndromes (2026) | https://whobluebooks.iarc.who.int/about/objective-and-historical-perspective ; https://publications.iarc.who.int/Book-And-Report-Series/Who-Classification-Of-Tumours | 2026-10-10 |
| WHO Blue Books 6th edition | Started. Vol. 1 **Digestive System Tumours** (6th ed.), ISBN 978-92-832-4548-3, 2026; IARC news 29 July 2026 announced print availability (online beta reported from Jan 2026 by ICCR). It supersedes 5th-ed. Vol. 1 (2019). No other 6th-ed. volume listed | https://www.iarc.who.int/news-events/publication-of-the-who-classification-of-tumours-6th-edition-volume-1-digestive-system-tumours/ ; https://publications.iarc.who.int/662 | 2026-10-10 |
| UICC TNM | **9th edition**, published 2025 (UICC; print via Wiley). Page does not state an effective date | https://www.uicc.org/what-we-do/sharing-knowledge/tnm (last update 16 July 2026) | 2026-10-10 |
| AJCC | 8th edition remains current for each site "until replaced with Version 9". Version 9 sites so far: Cervix Uteri (2021); Appendix, Anus, Brain & Spinal Cord (2023); NETs of appendix, colon/rectum, duodenum/ampulla, jejunum/ileum, pancreas, stomach, and Vulva (2024); Lung, Thymus, Diffuse Pleural Mesothelioma, Nasopharynx (2025); Salivary Glands, Oropharynx HPV-associated (2026). V9 sites take effect January 1 after release | https://www.facs.org/quality-programs/cancer-programs/american-joint-committee-on-cancer/version-9/ | 2026-10-10 |

## L. Crossref DOI checks

Command: `curl https://api.crossref.org/works/<DOI>`.

| Fact | Value | Source (URL or command) | Checked |
|---|---|---|---|
| 10.1177/1529100612453266 | "Improving Students' Learning With Effective Learning Techniques"; Dunlosky J (+Rawson, Marsh, Nathan, Willingham); Psychological Science in the Public Interest 14(1):4–58; 2013. **Match** | Crossref API | 2026-10-10 |
| 10.1111/tct.70353 | "The Effectiveness of Spaced Repetition in Medical Education: A Systematic Review and Meta-Analysis"; Maye J, Hurley F; The Clinical Teacher 23(2):e70353; online 2026-01-28. **Match** | Crossref API | 2026-10-10 |
| 10.1007/s40670-026-02643-5 | "Anki Use and Academic Performance in Medical Education: A Systematic Review of Evidence and Learning Theory"; Frappa N (+Chernov, Dillon, Alben); Medical Science Educator 36(2):1015–1025; online 2026-01-17. **Match** | Crossref API | 2026-10-10 |
| 10.1080/0142159X.2018.1430354 | "Test-enhanced learning in health professions education: A systematic review: BEME Guide No. 48"; Green M, Moeller J, Spak J; Medical Teacher 40(4):337–350; 2018. **Match** | Crossref API | 2026-10-10 |
| 10.1111/j.1365-2923.2008.03124.x | "Test-enhanced learning in medical education"; Larsen D, Butler A, Roediger III H; Medical Education 42(10):959–966; 2008. **Match** | Crossref API | 2026-10-10 |
| 10.1007/s10459-025-10437-4 | "Efficacy of mind maps and concept maps in enhancing academic performance among undergraduate medical students in the preclinical stage: a systematic review"; Aljamal H (+7); Advances in Health Sciences Education 31(2):705–725; online 2025-06-24, print 2026-04. **Match** (note: issue year is 2026; cite as 2025 online or 2026;31(2)) | Crossref API | 2026-10-10 |
| 10.1016/j.jacr.2023.08.028 | "The Effectiveness of Spaced Learning, Interleaving, and Retrieval Practice in Radiology Education: A Systematic Review"; Thompson C, Hughes M; J Am Coll Radiol 20(11):1092–1101; 2023. **Match** | Crossref API | 2026-10-10 |
| 10.1002/ase.1844 | "Optical Versus Virtual Microscope for Medical Education: A Systematic Review"; Kuo K, Leo J; Anatomical Sciences Education 12(6):678–685; online 2018-12-06, print 2019-11. **Match** (note: issue year is 2019) | Crossref API | 2026-10-10 |

## M. Follow-up checks (main agent, for pinning decisions)

| Fact | Value | Source (URL or command) | Checked |
|---|---|---|---|
| Latest Preact 10.x | 10.29.8 (within `@astrojs/preact` peer `^10.6.5`) | `npm view preact@10 version` | 2026-10-10 |
| Latest TypeScript 6.x | 6.0.3 (within `@astrojs/check` peer `^5.0.0 \|\| ^6.0.0`) | `npm view typescript@6 version`; `npm view @astrojs/check peerDependencies` | 2026-10-10 |
| @astrojs/check | 0.9.10 | `npm view @astrojs/check version` | 2026-10-10 |
| lighthouse (CLI) | 13.5.0; Apache-2.0; node `>=22.19`; last modified 2026-10-10 | `npm view lighthouse version engines license time.modified` | 2026-10-10 |
| @preact/signals 2.x | 2.11.3 | `npm view @preact/signals@2 version` | 2026-10-10 |
| Local dev machine | Node v24.14.0, npm 11.9.0, uv, gh, git present; no system PDF tools | `node -v`, `npm -v`, `which …` | 2026-10-10 |

## Could not verify

- **Astro: exact static-output mechanism of the i18n root redirect.** The i18n guide and config reference say `/` redirects to `/[defaultLocale]/` when `redirectToDefaultLocale: true`, but do not state how it is emitted in static output. The general `redirects` docs say static builds without an adapter use `<meta http-equiv="refresh">`; that this also applies to the i18n root redirect is an inference. Verify by building a test project and inspecting `dist/index.html`.
- **Safari: whether `persist()` exempts an origin from the 2020 seven-day script-writable-storage deletion.** The 2023 blog covers quota and eviction only and says nothing about the 7-day rule. No WebKit statement found.
- **Safari: user-facing prompt or exact grant criteria for `persist()`.** WebKit says only that it uses heuristics, giving Home Screen Web App as an example.
- **UICC TNM 9th edition effective date.** Not stated on the UICC page.
- **WHO 6th-edition volumes beyond Digestive System.** No upcoming-volume schedule found on the IARC pages; only Vol. 1 is listed.
- **Robbins PBD exact release date.** The Elsevier product page shows May 19, 2025; a search snippet of the same shop showed May 30, 2025. The edition (11th) and year (2025) are consistent.
- **Rubin's Pathology 9th edition.** No publisher page or announcement found; absence of evidence, not proof that none is planned.
- **Pagefind with no `<html lang>`.** The multilingual docs do not say what happens when a page lacks a `lang` attribute.
- **Alternative license scanner.** Not evaluated because `license-checker-rseidelsohn` is not stale (5.0.1, 2026-05-27). Note its engines require Node `>=24` and npm `>=11`.
