# Atlante di Patologia

**IT** — Atlante di anatomia patologica libero e bilingue (italiano/inglese), con un sistema di studio (ripasso a intervalli, quiz, allenamento sulle immagini) per studenti di medicina. Nessun account, nessun cookie, nessun tracciamento: i dati di studio restano nel browser. Dopo la prima visita la home si apre anche senza connessione; i capitoli pubblicati si possono scaricare per studiarli offline (Me → Uso offline).

**EN** — A free, bilingual (Italian/English) pathology atlas and study system (spaced review, quizzes, image training) for medical students. No accounts, no cookies, no tracking: study data stays in the browser. After the first visit the home page opens without a connection; published chapters can be downloaded to study offline (Me → Offline use).

Sito / Site: <https://mutablewarp.github.io/atlante-patologia/>

## Stato / Status

**Fase 2 / Phase 2.** Il primo capitolo (g01, danno, adattamento e morte cellulare) è pubblicato come bozza generata con IA e non ancora revisionata da esperti, con strumenti di studio e uso offline. / The first chapter (g01, cell injury, adaptation and death) is published as AI-generated content not yet reviewed by experts, with study tools and offline use. Status and evidence: [docs/PROGRESS.md](docs/PROGRESS.md); open review items: [docs/REVIEW_QUEUE.md](docs/REVIEW_QUEUE.md).

## Sviluppo locale / Run locally

Requires Node.js 24 (see `.nvmrc`; Astro 7 needs ≥ 22.12).

```sh
npm ci
npm run dev        # http://localhost:4321/atlante-patologia/
npm run build      # astro build + Pagefind index + service-worker manifest → dist/
npm run preview    # serve dist/
npm run check      # astro check (TypeScript)
npm test           # Vitest unit tests + content gates (npm run test:content for the gates only)
npm run validate:entity -- <id>   # content gates for one entity card
npm run test:dist  # validators on dist/ (navigation graph, links, budgets) — after build
npm run test:e2e   # Playwright (first: npx playwright install) — after build
npm run test:e2e:study    # study tools on a draft-fixture build (.e2e-study-dist/)
npm run test:e2e:offline  # service worker + offline packs, Chromium and WebKit (.e2e-dist/)
npm run lighthouse # Lighthouse mobile ≥ 90 on sample pages — after build
npm run licenses   # dependency license ledger → docs/licenses/
npm run guard      # containment guard over tracked files
npm run contrast   # WCAG contrast of design tokens
```

How to contribute content, translations and reviews: [CONTRIBUTING.md](CONTRIBUTING.md). Hosting limits and the mirror plan: [docs/OPERATIONS.md](docs/OPERATIONS.md).

Preview draft content (never published): `PREVIEW_DRAFTS=1 npm run dev`.

Install the pre-commit containment hook once: `npx simple-git-hooks`.

## Deploy

GitHub Actions (`.github/workflows/ci.yml`): every push and PR runs guard, type check, unit tests, license scan, build, contrast check, dist validators, Playwright (Chromium, Firefox, WebKit) and Lighthouse; pushes to `main` then deploy to GitHub Pages with `withastro/action` + `actions/deploy-pages`. In the repository settings, set **Pages → Source: GitHub Actions**.

## Struttura / Layout

- `src/content/` — content collections (schemas in `src/lib/schema.ts`, spec in `docs/CONTENT_SCHEMA.md`)
- `src/i18n/` — UI strings, one module per feature; every string has `it` and `en`
- `src/lib/` — pure TS helpers (`url.ts` for every internal link, relations, lenses, sections)
- `src/components/`, `src/layouts/`, `src/pages/[lang]/` — the site
- `docs/` — architecture, navigation spec, decisions, verified facts, compliance plan

## Licenze / Licenses

- Codice / Code: [MIT](LICENSE)
- Contenuti originali / Original content: [CC BY-SA 4.0](LICENSE-CONTENT.md)
- Immagini di terzi / Third-party images: their own licenses (Credits page)
- Fonts: SIL Open Font License 1.1

## Avvertenza / Disclaimer

**IT** — Solo a scopo didattico. Non usare per diagnosi o decisioni terapeutiche. I contenuti sono in parte generati con assistenza di IA e possono contenere errori. Segnala gli errori su <https://github.com/Mutablewarp/atlante-patologia/issues>.

**EN** — For education only. Not for diagnosis or treatment decisions. Content is partly AI-assisted and may contain errors. Report errors at <https://github.com/Mutablewarp/atlante-patologia/issues>.
