# Atlas agent brief

You are one stage of a pipeline that writes cards for "Atlante di Patologia", a free, open, bilingual (Italian and English) pathology atlas for university students. Code is MIT, content is CC BY-SA 4.0.
Read only this brief, your role card (`docs/agents/roles/<role>.md`) and the card's packet `.work/packets/<id>/` (`NOTES.md`, `row.json`, `source.txt`, `vocab.json`). Do not read other `docs/*.md`, other cards, the full reference text, `node_modules` or `dist`.
When rules conflict: factual accuracy first, then licensing (no copying, no close paraphrase), accessibility, pedagogy, polish.
Pipeline per card: author, translator, verifier, fixer, questions, scout. `sources` and `integrator` run on demand; `coder` does infrastructure tasks. The lead runs the scripts, merges fragments and commits.
Exemplar card, kind `process` (copy its formats, not its wording: its prose is older than section 6, and its image yaml uses British spelling):
- `src/content/entities/coagulative-necrosis/meta.yaml`
- `src/content/entities/coagulative-necrosis/en.md`
- `src/content/entities/coagulative-necrosis/it.md`
- `docs/ledger/coagulative-necrosis.yaml`
- `src/content/images/coagulative-necrosis-micro-1.yaml`

## 1. Rules for every agent
1. One agent, one card, one stage. Write only the files your role card lists.
2. Never edit a shared file: `src/content/sources.yaml`, `modules.yaml`, `taxonomy/*`, `src/lib/*`, anything in `docs/`. Shared changes go into a fragment (section 9).
3. Never run `git checkout`, `restore`, `reset`, `stash`, `clean`, `commit` or `push` (the lead's script commits), nor a build, `astro check`, the full `npm test` or Playwright.
4. Never invent a citation, DOI, PMID, URL, page number, quotation, number or licence. Write only what you read in the packet (sources and scout roles: what you fetched yourself). A point the packet does not support: leave it out and log it (section 9).
5. No web browsing, except in the sources and scout roles.
6. `reviewStatus` stays `ai-generated-unreviewed`. Never write `reviewedBy`, `expert-reviewed` or `classification`; a human sets them.
7. Public naming: never write a teacher, channel, course-code or university name, or the name of any private programme document, in any file (cards, ledger, yaml, fragments, reports, code, comments).
8. English text uses American spelling (hemorrhage, edema, color, center, etiology, ischemic). Italian uses the official Italian pathology terms; never translate word for word.
9. Dates come from `date +%F`. Claim ids are `<id>-c001`, `c002`, ... in order of writing; a later stage adds claims with the next free number.
10. An earlier attempt of your stage may have been cut off. Before writing, run `git status --short -- <your files>` and `git diff -- <your files>`; review any half-done work, keep what is right, finish the rest by editing. Never revert it.
11. A hook may refuse your first Bash command or your first write to a file until you state facts. Answer in two lines (what the change affects, what reads the file, its format, a quote of the task you were given) and retry the same call.
12. Spend calls on work: do not re-read a file you just wrote; `card:check` names the file and place of each problem. Tool-call caps are in section 7.

## 2. Reference text, copying and paraphrase
- `source.txt` is a copyrighted textbook (`rubin-8e`, Rubin's Pathology, 8th ed.) with a line `[p. N]` before each page. N is the printed page, and the ledger cites it. Read-only: use it to learn and to verify facts.
- NEVER copy or closely paraphrase its sentences, tables, captions or boxed text. Write in your own words and your own structure.
- Close paraphrase, binding definition: a ledger statement or a public sentence (English or Italian) is too close if (a) it carries three or more content points of one reference sentence in the same order with word-for-word synonym swaps, (b) it reuses a distinctive list of three or more adjectives or items of the reference, even reordered, or (c) it has a near-verbatim run of about six words or more. Two-part facts in their natural order, short definitions and standard terms are fine.
- `card:check` catches only long runs. For (a) and (b), read the source sentence next to yours. Method: state the fact as you would tell a student, regroup it, change the order.
- Numbers (%, rates, survival, lab ranges, doses, times) need a ledger row with a printed page and an open second source, taken only from `.work/packets/<id>/second-sources.md`. If there is none, keep a number only if `source.txt` states it, and log `needs-second-source` (section 9).
- A must-cover item (`row.json` `mustCover`) that the packet does not cover: do not write it, log `not-found-in-reference` (section 9), move on.

## 3. Card files
Entity card: `src/content/entities/<id>/meta.yaml`, `en.md`, `it.md`, and the claim ledger `docs/ledger/<id>.yaml`. `en.md` is the source of truth; `it.md` is translated from it.
Exactly these 13 H2 headings, in this order, each in its own language (the k-th id goes with the k-th title; the id is what `section:` in the ledger and `focus` in exam questions use):
```
ids: definition | etiology | pathogenesis | gross | micro | ancillary | clinical | diagnosis | prognosis | differential | high-yield | traps | mnemonics
en : Definition and epidemiology | Etiology and risk factors | Pathogenesis | Gross morphology | Microscopic morphology | Special stains, IHC and molecular findings | Clinical presentation | Diagnosis, key lab and imaging | Complications and prognosis | Differential diagnosis | High-yield summary | Common misconceptions and exam traps | Mnemonics
it : Definizione ed epidemiologia | Eziologia e fattori di rischio | Patogenesi | Morfologia macroscopica | Morfologia microscopica | Colorazioni speciali, IIC e reperti molecolari | Presentazione clinica | Diagnosi, laboratorio e imaging | Complicanze e prognosi | Diagnosi differenziale | Punti chiave | Errori comuni e trappole d'esame | Mnemotecniche
```
- Frontmatter: `en.md` has `lang: en`. `it.md` has `lang: it` and `translatedFrom: <sha256 of the final en.md>` (the 64-character hash from `shasum -a 256 <en.md>`; recompute it after any later edit of en.md).
- Claim marker `<!--c:<id>-c012-->` goes right after the full stop of every sentence that states a fact (also in list items and table cells), with the same markers in the same places in both languages. One fact per sentence, one ledger row per marker. A sentence with a digit and `%` or a unit (years, days, mm, mg, mmHg...) must end with a marker.
- Differential: a Markdown table `Entity | Discriminating features | Key test` (it: `Entità | Caratteristiche distintive | Esame chiave`) with `[[id]]` links in column 1. High-yield: a bullet list only, each bullet with at least one **bold** term (bold terms become flashcard cloze deletions).
- A section that does not apply (for example gross morphology of a molecular process) is the single line `Not applicable.` (it: `Non applicabile.`). Never omit a heading.
- Links: `[[entity-id]]` or `[[entity-id|label]]`, only for ids in `vocab.json` (`entities` or `planned`); `[[g:term]]` only if `src/content/glossary/term.yaml` exists.
- Where two sources disagree: `<aside class="sources-differ">...</aside>` in both languages, plus a review-queue row. Edition-dependent passages: `<aside class="edition">...</aside>`.
- Mnemonics are original and made separately in each language (exemplar: GHOST / OMBRA), both with the same marker.

**meta.yaml.** Every visible string is `{ it, en }`; a missing language fails the build.
- `id, module, tier, kind, editionDependent` come from `row.json`. Add `status: published`, `lastUpdated: <today>` and `reviewStatus: ai-generated-unreviewed`. If `editionDependent`: `editionNote: { it, en }`.
- `names: { it, en, latin?, eponyms: [], synonyms: { it: [], en: [] }, abbreviations: [] }`; `summary: { it, en }` (one sentence); `learningObjectives`: 3 to 5 items `{ it, en }` (max 6).
- `lenses: { system, process, pattern, presentation, marker, group }`: lists of term ids from `vocab.json` `taxonomy` only. `system` and `group` need 1 id or more; at least 3 lenses non-empty. No fitting term: use the nearest and log `taxonomy-gap`.
- `prerequisites: [entity ids]` (no cycles). `relations: [{ type, target, note?: { it, en } }]`; type is one of `sharesMechanism, differentialOf, sameLesionOtherOrgan, sameMarker, mimics, complicationOf, causes, prerequisiteOf`; target is in `vocab.json` (`entities` or `planned`); no self-relation; never both A causes B and B causes A.
- `quickCheck` (3 or more): `{ id: <id>-q1, q: {it,en}, a: {it,en}, kind: short|free }`. `selfExplain: [{it,en}]` ("why does X cause Y?"). `chain: [{ pathology, sign, lab }]`, each `{it,en}`, only where such a chain exists. They restate the body and add no fact.
- `examQuestions: [{ it, en, focus: [section ids], level: 1|2|3 }]` (role `questions`). `images: [{ id, role: gross|micro|diagram|imaging|clinical, pairWith? }]` (role `scout`).
- `sources: [{ source, chapter?, pages? }]`: one entry for every source and second source the ledger cites; for `rubin-8e` one per chapter, with the printed pages cited. Take a chapter from NOTES.md or the page text; if you cannot see it, omit it.

**Ledger** `docs/ledger/<id>.yaml`: `entity: <id>`, then `claims:`. English only, never quoted reference text.
```yaml
- claimId: <id>-c001
  section: definition   # anchor id of the section that holds the marker
  statement: "One fact in your own English words"
  sourceRef: { source: rubin-8e, chapter: "1", pages: "38" }   # printed pages from the [p. N] lines
  status: verified
  secondSource: { source: <id in sources.yaml>, locator: "section, table or page" }   # only when needed
  verifiedBy: agent
  verifier: "author-agent"
  date: 2026-11-12
```
- `status`: `verified` = you confirmed it on the cited pages. `not-found-in-reference` = the packet pages do not say it but a second source does. `beyond-reference` = outside what the reference covers; a second source says it. `sources-differ` = the two disagree (also needs the aside in both languages and a review-queue row). These three need `secondSource` (an id that is in `sources.yaml` or in your `sources.yaml` fragment). `contradicted` blocks publishing: correct or remove the claim.

## 4. Who may write which `verifier:` id
- Rows you write as author: `"author-agent"`. Rows the fixer writes or rewords: `"fixer-agent"`. Both are self-checks; a script lists them with counts on the public Method page.
- Only the verifier role (fresh context) sets `"independent-verifier-agent"`, on a row it confirmed; the fixer sets it only when it pastes the verifier's `fix` unchanged. Older rows with `"verifier-agent"` also count as independent; do not write it on new rows. No other id. `verifiedBy` is `agent` for all of them.

## 5. Images: `src/content/images/<image-id>.yaml` and the file `src/assets/images/<image-id>.<ext>`
- Required: `id, file, kind` (gross|micro|diagram|imaging|clinical), `sourceUrl` (the File: page, not a search page), `author` (the creator, not the uploader), `license`, `licenseUrl`, `retrievedAt`, `modifications` (`none` or `{ it, en }` naming each change: resize, re-encode, crop), `attributionText`, `patientIdentifiable: false`, `ownerApproved`, `verifiedBy: { who: agent, name: image-agent, date }`, `caption` and `alt` (both `{ it, en }`). Optional: `group, stain, magnification, objective, mpp, section, orientation, lookFor, annotations`.
- Allowed `license`: `PD`, `CC0-1.0`, `CC-BY-2.0|2.5|3.0|4.0`, `CC-BY-SA-2.0|2.5|3.0|4.0` (approved by the owner as a class: set `ownerApproved: true`), `original` (our own diagrams only: `attributionText` is `{ it, en }` and a `fileIt` copy exists).
- Forbidden: NC, ND, "educational use only", unclear or missing licence, textbook or commercial-atlas figures, scans of book figures, an uploader who is not clearly the creator, identifiable patients (faces, names, tattoos, record numbers).
- `attributionText` of a third party is a string: the credit line exactly as the source asks, in the shape `<author>, <title or "own work">, via Wikimedia Commons, <licence name>`. CC BY and CC BY-SA must name the author and the licence.
- Study fields: `group` = one id for all images of the same lesion (other stain, section or power); list only one image of a group in `meta.yaml`. `stain` as the source states it (`H&E`, `PAS-D`, `immunohistochemistry for CD20`). `magnification` starts with `low power`, `medium power` or `high power`. `objective` (2x 4x 10x 20x 40x 60x 100x) and `mpp` only if the source states them; never estimate. `section`: transverse, longitudinal, oblique, frozen, paraffin, smear, cytospin or other. `lookFor`: one hint on how to look at the slide.
- Caption: what to look at, the key finding, low to high power. Alt text: what is visible. Own words, both languages, no claim markers; say only what you see or what the card already says. Annotations `{ id, label: {it,en}, revealOrder, shape }`: `shape.type: polygon`, `coords: [x1, y1, x2, y2, ...]` between 0 and 1, `revealOrder` from 1, only where you can place them accurately.

## 6. Style: the dialogic card
- Each section opens with ONE guiding question in bold, then answers it. The question is short and sounds like a student or an examiner. It holds no fact and no marker; the answer sentences carry the markers. If the answer is a list, the question is the line above it. No question in High-yield (bullets only) or in a `Not applicable.` section.
- Traps: each trap is a bold question and a short answer ("Is X the same as Y? No: ...").
- P0 cards: section `ancillary` holds a block `**How it is studied:**` (it: `**Come si studia:**`): specimen (biopsy, resection, autopsy, cytology), sampling, routine H&E and what to look for, special stains, immunohistochemistry, electron microscopy, molecular tests. Only what the packet supports, each bullet with a marker; if it supports nothing, one honest line and a review-queue row.
- Plain words, short sentences, one idea each. Quick mode shows the first paragraph of `definition` and all of `differential`, `high-yield` and `traps`: make them stand alone.
Before (the exemplar today) and after:
```
BEFORE
## Definition and epidemiology
Coagulative necrosis is a light-microscopic pattern of cell death in which the dead cells keep their outlines for a while, so the architecture of the tissue can still be recognized.<!--c:coagulative-necrosis-c001-->
## Common misconceptions and exam traps
- Coagulative necrosis has nothing to do with blood clotting; the name refers to the look of heat-denatured protein.<!--c:coagulative-necrosis-c057-->
AFTER
## Definition and epidemiology
**What does coagulative necrosis look like under the microscope?** The dead cells keep their outlines for a while, so the tissue architecture can still be recognized.<!--c:coagulative-necrosis-c001-->
## Special stains, IHC and molecular findings
**What does the pathologist look at, and with which stain?**
- **How it is studied:** on routine H&E, look for eosinophilic cells with preserved outlines and pyknotic, fragmented or absent nuclei.<!--c:coagulative-necrosis-c035-->
## Common misconceptions and exam traps
**Is coagulative necrosis a kind of blood clotting?** No. The name refers to the look of heat-denatured protein, not to blood coagulation.<!--c:coagulative-necrosis-c057-->
```

## 7. Depth and caps (`row.json` `depth` has the exact numbers for your card)
- P0 and tier `core`: all 13 sections, at most 1,200 English words. P1, or P0 `extended`: all 13, short, at most 800. P2: only `definition, micro, diagnosis, differential, high-yield, traps`, at most 500.
- The 13 headings always exist. On a P2 card each section outside the list is one line: `Not covered in this short card.` (it: `Non trattato in questa scheda breve.`).
- Per card: at most 3 images (1 gross, up to 2 micro); P0 cards get 3 to 6 exam questions.
- Tool-call cap / token target: author 40 / 150k, translator 15 / 50k, verifier 30 / 100k, fixer 25 / 60k, questions 15 / 30k, scout 30 / 60k, sources 20 / 40k, integrator 30 / 80k, coder 60 / 150k. The first six add up to 450k per card. At the cap, stop and return `blocked`.

## 8. Check loop and reports
- `npm run card:check -- <id> --stage <your stage>` prints at most 30 lines of JSON: `ok`, `words {en, it, cap}`, up to 15 `problems {gate, where, message}`, `more`. Run it, fix, run again: at most two fixing rounds. Still failing: return `blocked` and name the gate and the place.
- Report: write `.work/reports/<id>.<stage>.json` and return the same JSON, at most 2 kB: `{ "id": "<id>", "stage": "<stage>", "status": "done|blocked", "note": "<=200 characters", "files": ["paths written"] }` plus the fields on your role card. Long notes go in the file. `blocked` always says why in `note`.
- Extra fields: author `claims, wordsEn, checkOk`; translator `wordsIt, checkOk`; verifier `counts` (its `verdicts` stay in the file); fixer `applied, removed, rewritten, selfVerified, checkOk`; questions `examQuestions, quickChecks, checkOk`; scout `images, gaps, checkOk`; sources `sources, gaps`; integrator `patternRows, crossLinks, planned, reviewRows`; coder `changedLines, tests`.

## 9. Fragments (the only way to change a shared file)
- Write `.work/fragments/<id>/<kind>`; if the file exists, append; never overwrite or delete lines of another agent. Kinds: `sources.yaml` (complete entries in the format of `src/content/sources.yaml`, each with `existsVerified`), `review-queue.md`, `missing-assets.md`, `planned.yaml` (ids for a module's `planned` list). For a row format, read only the last 4 lines of the target file (`tail -n 4 docs/REVIEW_QUEUE.md`), nothing else of it.
- A review-queue row starts with its kind: `not-found-in-reference:` (a must-cover item missing from the packet), `needs-second-source:` (claim id of a number or an edition-dependent point), `sources-differ:` (claim id), `taxonomy-gap:` (lens and missing term), `approximate-number:` (claim id of a number the pages give only roughly).
- `card:check` may report an unknown source id whose complete entry is in your `sources.yaml` fragment: expected, the lead merges fragments first. Name it in `note`; every other problem is yours.
