<!-- Italiano o inglese vanno bene entrambi. / Italian or English are both fine. -->

## Cosa cambia / What changes

<!-- Una o due frasi. Collega l'issue se c'è (Closes #…). / One or two sentences. Link the issue if any (Closes #…). -->

## Tipo / Type

- [ ] Contenuti (schede, registro delle affermazioni, immagini) / Content (cards, claim ledger, images)
- [ ] Traduzione / Translation
- [ ] Codice o interfaccia / Code or UI
- [ ] Documentazione / Docs

## Contenuti: verifica sulle fonti / Content: source check

- [ ] Ogni affermazione ha un marcatore e una riga nel registro con fonte e pagine stampate. / Every claim has a marker and a ledger row with source and printed pages.
- [ ] Testo scritto con parole mie; nessuna frase, tabella o figura copiata. / Written in my own words; no copied sentences, tables or figures.
- [ ] Le due lingue hanno le stesse sezioni e gli stessi marcatori. / Both languages have the same sections and markers.
- [ ] Immagini con licenza, autore e fonte; nessun paziente riconoscibile. / Images with license, author and source; no identifiable patient.
- [ ] Non ho impostato `expert-reviewed` (solo un revisore umano può farlo). / I did not set `expert-reviewed` (only a human reviewer may).

## Controlli / Gates

- [ ] `npm run check` · `npm test` · `npm run build` · `npm run test:dist`
- [ ] `npm run test:e2e` (se tocca l'interfaccia / if it touches the UI)
- [ ] Ogni nuova stringa visibile esiste in italiano e in inglese. / Every new visible string exists in Italian and English.
- [ ] Nessuna richiesta a terzi (CDN, font, script, embed). / No third-party requests (CDN, fonts, scripts, embeds).
