# Decisions

Format: ID — decision — reason — status. "Deviation" marks a departure from the brief. Facts cited are in [VERIFIED_FACTS.md](VERIFIED_FACTS.md) (checked 2026-10-10).

## Accepted (agent, within the brief)

| ID | Decision | Reason | Status |
|---|---|---|---|
| D001 | Phase 0 runs in the session's scratch workspace; the project moves to a permanent folder once the owner picks a name | The folder name depends on the product name; the scratch folder is deleted with the session (R19) | accepted, temporary |
| D002 | References are **symlinked** into `/reference/`, never copied; extracted text goes to gitignored `/.work/` | Zero chance of a stray copy; containment before any git init | accepted |
| D003 | Node **24 LTS** (24.21.0) for dev and CI; `withastro/action` defaults to 24 | Current Active LTS; Astro 7 needs ≥ 22.12 (even majors only). Re-evaluate Node 26 after it becomes LTS on 2026-10-28 | accepted |
| D004 | Islands in **Preact 10.29.8** with `@astrojs/preact` 6.0.6 and signals; **not Preact 11** | Small runtime with JSX; Preact 11 is outside the integration's peer range (^10.6.5). Svelte 5 was considered: its integration's TS peer range also excludes TS 7, and contributors are more likely to know JSX | accepted |
| D005 | TypeScript **6.0.3** strict; **not TS 7** | `@astrojs/check` 0.9.10 and `@astrojs/svelte` declare peers ^5 \|\| ^6 | accepted |
| D006 | **Deviation:** hand-written service worker plus a build-time precache manifest, instead of `@vite-pwa/astro` | `@vite-pwa/astro` 1.2.0 (last release 2025-11-27) supports Astro ≤ 5 and `vite-plugin-pwa` ^1.2 only; Astro 6/7 issues are open. The needed behaviour (shell precache, network-first navigations, opt-in packs, storage meter) is ~150 lines, and hashed Astro assets make revisioning simple | accepted; covered by offline Playwright tests |
| D007 | **Deviation:** `lighthouse` 13.5.0 CLI + assertion script instead of Lighthouse CI (`@lhci/cli`) | `@lhci/cli` has had no release since 2025-06-25; `lighthouse` is current (Apache-2.0). Same ≥ 90 thresholds | accepted |
| D008 | npm as package manager | Ships with Node; no extra tool for contributors | accepted |
| D009 | Entity = folder with `meta.yaml` (structured, bilingual short fields) + `en.md` + `it.md` (13 fixed H2 sections, canonical localized titles mapped to stable anchors); claim markers as HTML comments | Reviewers read one language end-to-end; parity is checkable (section list + markers); anchors are identical across languages; no custom markdown syntax | accepted |
| D010 | **Interpretation:** `/{lang}/atlas/{lens}/{slug}/` = lens-term listing page; entities only at canonical `/{lang}/e/{id}/`. Language-neutral ids in all URLs | One URL per entity (no duplicate pages, no build-size blow-up); language switch = swap prefix; satisfies the brief's two URL shapes | accepted — owner may override |
| D011 | Lens context via `?via=lens:term`, progressive enhancement; server default = primary organ-system order; canonical ignores the query | Static site cannot know the lens otherwise; works without JS | accepted |
| D012 | Symmetric relations declared once and mirrored at build; validator rejects conflicts, self-links, contradictory directed pairs, unknown targets | Less authoring, same guarantees as two-sided declaration | accepted |
| D013 | Flashcards generated from **bold terms in high-yield bullets** (cloze), `quickCheck` (Q/A), image annotations (occlusion); card id = entity + kind + hash of English source | No duplicate authoring; ids are shared across languages; an edited fact becomes a new card | accepted |
| D014 | All validators are **Vitest suites** (`tests/content` before build, `tests/dist` after build); schemas live in one TS module used by Astro and by tests | One runner, one schema definition, typed | accepted |
| D015 | ~~System font stack~~ → **self-hosted OFL fonts**: Fraunces (display) + Atkinson Hyperlegible Next (body) via `@fontsource-variable/*` 5.3.0, bundled into the site | Revised 2026-10-10: a distinctive, highly legible type pair for an atlas; self-hosting keeps zero third-party requests; OFL-1.1 recorded in the license ledger | accepted (revised) |
| D016 | No-verbatim guard uses **pdfjs-dist** (Apache-2.0) in-repo; PyMuPDF (AGPL-3.0) was used only for Phase 0 exploration, run via `uv run --with`, nothing committed | Keeps the repo license-clean and Node-only for contributors | accepted; pdfjs version to verify in Phase 1 |
| D017 | Phase 2 vertical slice = **g01 Cell injury, adaptation and death** + Pattern Page **p01 Types of necrosis** | Foundation for all later modules; exercises every relation type and the horizontal layer | proposed — owner may change |
| D018 | Two tiers: **core** (~590) before **extended** (~600) | Makes R1/R8 manageable; core alone is a useful product | proposed — depends on owner's scope answer |
| D019 | No-verbatim thresholds: any shared **12-word** run fails; **> 1%** 8-gram overlap per file fails | Rationale in COMPLIANCE_PLAN §1a; calibrated in Phase 1 with recorded results | accepted pending calibration |
| D020 | Per-tab back stack = last URL per tab in `sessionStorage`; browser history untouched | Meets "each tab keeps its own back stack" on a multi-page site without breaking Back | accepted |
| D021 | A–Z lens excluded from the "≥ 3 lenses" gate | Every entity is in A–Z, so counting it would weaken the check | accepted |
| D022 | Ledger cites **printed** page numbers; for `rubin-8e` printed = PDF − 24 (constant across 1,198 checked pages) | Owner/reviewers can check a physical copy | accepted |
| D023 | `reviewStatus` ∈ {`ai-generated-unreviewed`, `expert-reviewed`}; `expert-reviewed` requires `reviewedBy` and a committer listed in `REVIEWERS`; agents never set it | Enforces "only a human reviewer can set expert-reviewed" mechanically | accepted |
| D024 | **English is the authoring language**; Italian is translated from our English (never from the reference) and then edited for idiomatic Italian | The n-gram guard works only within one language (COMPLIANCE_PLAN §1a blind spot) | accepted — owner may prefer Italian-first if an Italian reference is supplied |
| D025 | One workflow: `test` job gates a `deploy` job on `main` (`withastro/action@v6` → `actions/deploy-pages@v5`) | Nothing deploys unless all gates pass; uses the official actions the brief asks for | accepted; verify the action runs our full `build` script |
| D026 | Image formats: start with AVIF + WebP at 2 widths; switch to AVIF-only + small WebP fallback if Phase 2 measurements project > 220 MB of images at full scope | Decide from measured bytes, not guesses | pending Phase 2 measurement |
| D027 | Root `/` is our own `src/pages/index.astro` (JS language detection + no-JS links); `prefixDefaultLocale: true`, `redirectToDefaultLocale: false` | Astro's static redirect would always go to one default language; the brief wants browser-language detection with a no-JS fallback | accepted |

## Owner answers (CHECKPOINT 1, 2026-10-10)

| ID | Answer |
|---|---|
| O1 | Name: **Atlante di Patologia**; repo `atlante-patologia`; URL `https://mutablewarp.github.io/atlante-patologia/` (trademark check still to do) |
| O2 | **MIT** (code) + **CC BY-SA 4.0** (content) |
| O3 | GitHub Pages project site on account `Mutablewarp` |
| O4 | Accepted the recommendation implicitly ("perfetto"): core tier first; this round = Phase 1 + first chapter (g01) |
| O5 | Italian default (accepted recommendation) |
| O6 | Open: Italian reference and second current textbook not yet supplied |

## Waiting for the owner (CHECKPOINT 1) — original questions

| ID | Question | Agent's recommendation |
|---|---|---|
| O1 | Product name | — (no publisher/product marks) |
| O2 | Code and content licenses | MIT + CC BY-SA 4.0 (trade-offs in COMPLIANCE_PLAN §3) |
| O3 | Domain | `<user>.github.io/<repo>` now; custom domain later is a config change |
| O4 | Syllabus scope and depth | Core tier of all modules except o34; extended tier later |
| O5 | Default language | Italian (fallback for `/` without JS or language match) |
| O6 | References: confirm edition and lawful access; any Italian reference and/or a current second textbook | Add an Italian reference for terminology; a 2025 edition textbook for currency |

## Phase 1 foundation (agent, 2026-10-10)

| ID | Decision | Reason | Status |
|---|---|---|---|
| D028 | All pinned versions installed exactly as listed (no fallback needed); `npm install` reported 0 vulnerabilities and no peer conflicts | — | done |
| D029 | **Deviation (dependency added):** `yaml` 2.9.1 as an exact devDependency | Vitest validators parse `src/content/**/*.yaml` with the same Zod schemas Astro uses; `yaml` was already in the tree transitively (`@astrojs/check`), now declared so tests do not rely on a transitive package | accepted |
| D030 | Entity sections are split from the **rendered HTML** (`src/lib/sections.ts`) instead of a rehype plugin | Astro 7 makes **Sätteri** the default Markdown processor; `markdown.rehypePlugins` now needs `@astrojs/markdown-remark` (unified). Splitting on the canonical H2 titles works with any processor, keeps anchors stable (`#micro`) and is unit-tested; a non-canonical H2 fails the build | accepted |
| D031 | Colour tokens written once with CSS `light-dark()`; theme chosen by `color-scheme` (system by default, forced by `html[data-theme]`) | One source of truth that `scripts/contrast-check.mjs` parses; no duplicated dark blocks. Requires Safari ≥ 17.5 / Chrome ≥ 123 / Firefox ≥ 120 | accepted |
| D032 | Italian label for "Me" is **Profilo**; Atlas/Study/Search are Atlante/Studio/Cerca | "Io" reads oddly as a tab label; "Profilo" is the common Italian convention even without accounts | accepted — owner may change |
| D033 | `PREVIEW_DRAFTS=1` read from `process.env` at build time (`src/lib/content.ts`) | Static build; no runtime env needed. CI asserts the fixture entity is absent from `dist/` | accepted |
| D034 | Verified `withastro/action@v6` (action.yml, 2026-10-10): inputs `node-version` (default 24), `package-manager`, `path`, `build-cmd`, `cache`, `cache-dir`, `out-dir`; default build step is `<pm> run build`, so our `astro build && pagefind --site dist` runs; uploads `dist/` with `actions/upload-pages-artifact@v5` | Confirms D025 | verified |
| D035 | Pagefind is used through its JS API (`pagefind/pagefind.js`) with our own small search UI instead of the bundled UI | Full control of i18n strings, base path (`baseUrl`) and accessibility (labelled form, live status region) | accepted |
| D036 | Lens term pages are generated only for terms with ≥ 1 visible entity; lens index pages always exist and show counts with an honest empty state | No empty pages, no dead links | accepted |
| D037 | Empty collection directories (patterns, questions, images, glossary, paths) are not created; Astro logs a warning and the build passes | Avoids placeholder files; agents create the folder with the first entry | accepted |
| D038 | `[[id]]` cross-links inside Markdown bodies are **not yet resolved** | Needs a processor-independent resolver (planned with the content validators) | open |
