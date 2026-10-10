# Atlante di Patologia

**IT** — Atlante di anatomia patologica libero, bilingue (italiano/inglese) e consultabile offline, con un sistema di studio (ripasso a intervalli, quiz, allenamento sulle immagini) per studenti di medicina. Nessun account, nessun cookie, nessun tracciamento: i dati di studio restano nel browser.

**EN** — A free, bilingual (Italian/English), offline-capable pathology atlas and study system (spaced review, quizzes, image training) for medical students. No accounts, no cookies, no tracking: study data stays in the browser.

Sito / Site: <https://mutablewarp.github.io/atlante-patologia/>

## Stato / Status

**Fase 1 / Phase 1.** La struttura del sito è online; il primo capitolo (g01, danno, adattamento e morte cellulare) è in scrittura e verifica. / The site structure is live; the first chapter (g01, cell injury, adaptation and death) is being written and verified. See `docs/` for the spec and the roadmap page on the site.

## Sviluppo locale / Run locally

Requires Node.js 24 (see `.nvmrc`; Astro 7 needs ≥ 22.12).

```sh
npm ci
npm run dev        # http://localhost:4321/atlante-patologia/
npm run build      # astro build + Pagefind index → dist/
npm run preview    # serve dist/
npm run check      # astro check (TypeScript)
npm test           # Vitest unit tests
npm run guard      # containment guard over tracked files
node scripts/contrast-check.mjs   # WCAG contrast of design tokens
```

Preview draft content (never published): `PREVIEW_DRAFTS=1 npm run dev`.

Install the pre-commit containment hook once: `npx simple-git-hooks`.

## Deploy

GitHub Actions (`.github/workflows/ci.yml`): every push and PR runs guard, type check, tests, build and contrast check; pushes to `main` then deploy to GitHub Pages with `withastro/action` + `actions/deploy-pages`. In the repository settings, set **Pages → Source: GitHub Actions**.

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
