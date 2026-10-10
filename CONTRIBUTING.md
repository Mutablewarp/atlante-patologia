# Contribuire / Contributing

[Italiano](#italiano) · [English](#english)

---

## Italiano

Grazie per voler migliorare l’Atlante di Patologia. Il progetto è didattico: ogni affermazione deve essere verificabile su una fonte, e nessun testo, tabella o figura protetti da diritto d’autore può entrare nel repository.

### Segnalare un problema

Usa i moduli in [Issues](https://github.com/Mutablewarp/atlante-patologia/issues/new/choose): errore nei contenuti, diritti d’autore e rimozione, accessibilità, traduzione. Le issue sono pubbliche: non inserire dati personali o sanitari, e non chiedere consulenze cliniche.

### Aggiungere o correggere una scheda

Lo schema completo è in [`docs/CONTENT_SCHEMA.md`](docs/CONTENT_SCHEMA.md). In breve:

1. Una scheda vive in `src/content/entities/<id>/` con `meta.yaml`, `it.md` ed `en.md`.
2. `it.md` ed `en.md` hanno le stesse 13 sezioni H2, nello stesso ordine, con i titoli esatti di `src/i18n/sections.ts`. Una sezione che non si applica contiene una riga “non applicabile”, non viene tolta.
3. Ogni frase che afferma un fatto finisce con un marcatore `<!--c:<id>-c001-->`, identico nelle due lingue.
4. Ogni marcatore ha una riga nel registro `docs/ledger/<id>.yaml`, scritta con parole tue, con la fonte (testo, capitolo, pagine stampate) e lo stato di verifica. I numeri (percentuali, sopravvivenza, valori di laboratorio) richiedono sempre una fonte.
5. Una nuova scheda parte con `reviewStatus: ai-generated-unreviewed` e `status: draft`. Solo un revisore umano imposta `expert-reviewed`.
6. Le mnemotecniche devono essere originali.

### Verificare sulle fonti

- Scrivi sempre con parole tue. Non copiare frasi, tabelle o figure dal libro di riferimento: il controllo anti-copia (`npm run no-verbatim`) blocca sequenze di 12 parole uguali.
- Indica le pagine stampate, non quelle del PDF.
- Se due fonti non concordano, usa `<aside class="sources-differ">` nel testo e annotalo nel registro.
- Le immagini richiedono licenza, autore e link alla fonte (`docs/CONTENT_SCHEMA.md` §5). Nessuna immagine con pazienti riconoscibili.
- Non salvare mai materiale protetto in `reference/`, `.work/` o `private/` dentro i commit: il controllo pre-commit lo impedisce.

### Tradurre

L’italiano è la lingua predefinita. Usa la terminologia dei testi italiani di anatomia patologica; se un termine non è standard, segnalalo nella pull request con una fonte. Le stringhe dell’interfaccia stanno in `src/i18n/`, un modulo per funzione, sempre con `it` ed `en`.

### Revisionare

Un revisore controlla ogni affermazione con il suo marcatore sul registro e sulla fonte, segnala le divergenze, e solo dopo imposta `expert-reviewed` con nome e data in `reviewedBy`.

### Controlli da superare

Prima di aprire una pull request:

```sh
npm ci
npx simple-git-hooks   # una volta: attiva il controllo pre-commit
npm run check          # TypeScript e Astro
npm test               # test unitari
npm run build          # sito + indice di ricerca
npm run test:dist      # grafo di navigazione, link, ancore, budget di peso, nessuna risorsa esterna
npm run test:e2e       # Playwright: axe, tastiera, navigazione, privacy, lingue (prima: npx playwright install)
npm run lighthouse     # punteggi mobile ≥ 90
npm run licenses       # licenze delle dipendenze
npm run no-verbatim    # solo in locale, se hai i testi di riferimento
```

La CI ripete gli stessi controlli. I messaggi di commit seguono [Conventional Commits](https://www.conventionalcommits.org/).

---

## English

Thank you for helping improve Atlante di Patologia. The project is educational: every statement must be checkable against a source, and no copyrighted text, table or figure may enter the repository.

### Reporting a problem

Use the forms under [Issues](https://github.com/Mutablewarp/atlante-patologia/issues/new/choose): content error, copyright and takedown, accessibility, translation. Issues are public: do not include personal or health information, and do not ask for clinical advice.

### Adding or fixing a card

The full schema is in [`docs/CONTENT_SCHEMA.md`](docs/CONTENT_SCHEMA.md). In short:

1. A card lives in `src/content/entities/<id>/` with `meta.yaml`, `it.md` and `en.md`.
2. `it.md` and `en.md` have the same 13 H2 sections, in the same order, with the exact titles from `src/i18n/sections.ts`. A section that does not apply holds one “not applicable” line; it is never removed.
3. Every sentence that states a fact ends with a marker `<!--c:<id>-c001-->`, identical in both languages.
4. Every marker has a row in the ledger `docs/ledger/<id>.yaml`, in your own words, with the source (book, chapter, printed pages) and its verification status. Numbers (percentages, survival, lab values) always need a source.
5. A new card starts as `reviewStatus: ai-generated-unreviewed` and `status: draft`. Only a human reviewer sets `expert-reviewed`.
6. Mnemonics must be original.

### Checking against sources

- Always write in your own words. Do not copy sentences, tables or figures from the reference textbook: the no-verbatim check (`npm run no-verbatim`) blocks any shared run of 12 words.
- Cite printed page numbers, not PDF page numbers.
- When two sources disagree, use `<aside class="sources-differ">` in the text and record it in the ledger.
- Images need a license, an author and a source link (`docs/CONTENT_SCHEMA.md` §5). No images of identifiable patients.
- Never commit anything from `reference/`, `.work/` or `private/`: the pre-commit guard blocks it.

### Translating

Italian is the default language. Use the terminology of Italian pathology textbooks; if a term is not standard, flag it in the pull request with a source. Interface strings live in `src/i18n/`, one module per feature, always with `it` and `en`.

### Reviewing

A reviewer checks every claim marker against the ledger and the source, reports disagreements, and only then sets `expert-reviewed` with a name and date in `reviewedBy`.

### Gates to pass

Before opening a pull request:

```sh
npm ci
npx simple-git-hooks   # once: enables the pre-commit guard
npm run check          # TypeScript and Astro
npm test               # unit tests
npm run build          # site + search index
npm run test:dist      # navigation graph, links, anchors, size budget, no external assets
npm run test:e2e       # Playwright: axe, keyboard, navigation, privacy, languages (first: npx playwright install)
npm run lighthouse     # mobile scores ≥ 90
npm run licenses       # dependency licenses
npm run no-verbatim    # local only, when you have the reference texts
```

CI runs the same gates. Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/).

By contributing you agree that code is licensed under [MIT](LICENSE) and content under [CC BY-SA 4.0](LICENSE-CONTENT.md), and that you follow the [Code of Conduct](CODE_OF_CONDUCT.md).

Contribuendo accetti che il codice sia rilasciato con licenza [MIT](LICENSE) e i contenuti con [CC BY-SA 4.0](LICENSE-CONTENT.md), e ti impegni a rispettare il [Codice di condotta](CODE_OF_CONDUCT.md).
