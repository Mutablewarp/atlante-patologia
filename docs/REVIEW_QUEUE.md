# Review queue

Items a human expert must look at before the related content can be marked `expert-reviewed`
(CONTENT_SCHEMA §1b, §8). Agents append entries; only a human closes them. Never paste reference text here.

## When to add an entry

- A ledger row has status `sources-differ` (the text must also carry `<aside class="sources-differ">`).
- A ledger row has status `not-found-in-reference` or `beyond-reference` (it needs `secondSource`).
- A number was written as "approximately" because no source could be found.
- Terminology, translation or classification choices the author was unsure about (e.g. an Italian term).
- A lens term or relation target was missing and the closest existing one was used instead.

## How to write an entry

One row per item, newest at the bottom. Keep the issue to one sentence in your own words.

| Date | Entity / file | Claim id or section | Issue | Status | Opened by | Closed by |
|---|---|---|---|---|---|---|
| YYYY-MM-DD | `<entity-id>` | `<entity-id>-c###` or `#section` | what needs a human decision | open \| resolved \| wontfix | agent run id | reviewer name + date |

## Entries

| Date | Entity / file | Claim id or section | Issue | Status | Opened by | Closed by |
|---|---|---|---|---|---|---|
| 2026-10-10 | `hypoxic-ischemic-injury-micro-1`, `hypoxic-ischemic-injury-gross-1` | image license | Commons file pages are tagged CC BY 3.0, but the source article (Michaud et al., Virchows Arch 2019, PMC7028821) is CC BY 4.0; the YAML uses CC BY 4.0, the creators' grant. Confirm. | open | image-agent | |
| 2026-10-10 | `pyroptosis` | `pyroptosis-c007`, `-c017`, `-c018`, `-c019`, `-c023`, `-c033`, `-c041`, `-c042`, `-c047` | Gasdermin D cleavage/pores, caspase-4/5/11 LPS sensing and pore-mediated IL-1β release are not in `rubin-8e` (which only says caspase-1 forms pores); status not-found-in-reference with second sources shi-2015, ding-2016, evavold-2018 (abstract-level check, added to sources.yaml). Confirm. | open | author-agent g01/pyroptosis | |
| 2026-10-10 | `pyroptosis` | `meta.yaml` lenses | No taxonomy term for "inflammasome"; used process/acute-inflammation and presentation/fever (periodic fever syndromes) as closest terms. | open | author-agent g01/pyroptosis | |
| 2026-11-03 | `coagulative-necrosis` | `coagulative-necrosis-c062` | The EN mnemonic (GHOST) and the IT mnemonic (OMBRA) are deliberately different original acrostics covering the same facts; confirm both are acceptable. | open | fixer-agent | |
| 2026-11-03 | `fibrinoid-necrosis` | `fibrinoid-necrosis-c043`, `-c073` | Malignant hypertension thresholds differ within `rubin-8e` (ch. 16 p. 617: at least 180/120 mm Hg; ch. 22 pp. 950-951: diastolic above 130 mm Hg); text uses 180/120 with a sources-differ aside. Confirm. | open | fixer-agent | |
| 2026-11-03 | `fibrinoid-necrosis` | `meta.yaml` synonyms.it | Replaced "Insudazione fibrinoide" with "Alterazione fibrinoide" as the Italian counterpart of "fibrinoid change"; confirm it is current Italian usage. | open | fixer-agent | |
| 2026-11-03 | `src/content/glossary/` (g01) | `plasma-membrane-blebs`, `eat-me-signals`, `ghost-cells`, `myelin-figures`, `fat-stains` | Italian glossary terms chosen without an Italian reference ("Bolle della membrana plasmatica (blebs)", "Segnali «eat me»", "Cellule fantasma", alias "figure mielinoidi", "Colorazioni per i grassi"); confirm current Italian usage. | open | content-agent g01/glossary | |
| 2026-11-03 | `pigment-accumulation` | `pigment-accumulation-c072` | The melanosis coli mechanism (anthraquinone-induced epithelial apoptosis, pigment digested by macrophages) is beyond `rubin-8e` ch. 1; status beyond-reference with second source walker-1988 (abstract-level check). Confirm. | open | finalizer g01 | |
| 2026-11-03 | g01 images | `pairWith` in entity meta.yaml | Gross images were paired with a micrograph of the same lesion type (not always the same case): caseous-necrosis, dystrophic-calcification, hypertrophy, hypoxic-ischemic-injury, intracellular-accumulations, ischemia-reperfusion-injury, metastatic-calcification. Confirm the pairings teach a valid gross–micro correlation. | open | finalizer g01 | |
| 2026-11-03 | `coagulative-necrosis` | `coagulative-necrosis-c017`, `-c063`, `-c018`, `-c039` | Integration added these existing markers to the time cells of the infarct timeline table (numbers gate); the text says "After 4 weeks" while c039 says "Beyond 4 weeks". Confirm the times and wording. | open | integrator | |
| 2026-11-04 | `pathway-intrinsic-apoptosis` | `intrinsic-apoptosis-c017`, `-c018`, `-c023` | `rubin-8e` has caspase-9 activate caspase-6 directly, executioner caspases cut proteins indiscriminately and apoptosis irreversible; slee-1999, thornberry-1997 and tang-2012 (abstract-level check) disagree. Text follows the primary literature with a sources-differ aside. Confirm. | open | fixer-agent | |
| 2026-11-04 | `pathway-intrinsic-apoptosis` | `intrinsic-apoptosis-c005`, `-c006` | Step 3 reworded so it no longer contradicts step 4 on where BAX sits (BAX mostly cytosolic, BAK mainly mitochondrial; BH3-only proteins free or directly activate BAX/BAK), per `rubin-8e` p. 49. Confirm. | open | fixer-agent | |
| 2026-11-04 | `pathway-intrinsic-apoptosis` | `intrinsic-apoptosis-c007`, `-c009`, `-c013`, `-c016` | The venetoclax use, the BAX α9 helix, the heptameric apoptosome and XIAP BIR3 holding caspase-9 are beyond `rubin-8e`; status beyond-reference with second sources birkinshaw-2019, suzuki-2000, zhou-2015 and shiozaki-2003 (abstract-level check, confirmed by the independent verifier). Confirm. | open | fixer-agent | |
