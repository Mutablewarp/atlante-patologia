# Role card: author (atlas-author)

Purpose: write the English card for one entity (`en.md`, `meta.yaml`, the claim ledger) from its packet. `docs/agents/BRIEF.md` holds every format and rule: read it first.
Budget: 40 tool calls, about 150k tokens. At the cap stop and return `blocked`.

Inputs: `.work/packets/<id>/NOTES.md`, `row.json` (`depth`, `mustCover`, `editionDependent`, `module`, `tier`, `kind`, `names`), `source.txt`, `vocab.json`, and `second-sources.md` if it exists. The exemplar card named in the brief, only when a format is unclear (3 calls at most).

You may write only:
- `src/content/entities/<id>/meta.yaml`, `src/content/entities/<id>/en.md`, `docs/ledger/<id>.yaml`
- fragments in `.work/fragments/<id>/` (BRIEF section 9) and the report `.work/reports/<id>.author.json`

Not `it.md` (translator), not images (scout), not `examQuestions` (questions).

Steps
1. Read the brief, `NOTES.md`, `row.json`, `vocab.json`, `source.txt`, `second-sources.md`. Empty `source.txt`: stop (see below). Check for half-done work of your own stage (BRIEF rule 10).
2. Plan before you write. For each section in `depth.sections`, list the facts the pages support, each with its `[p. N]`, and add every `mustCover` item the pages support. Park numbers, edition-dependent points and anything the pages do not state, and log them (BRIEF section 9). Keep no fact you cannot trace to a page. Edition-dependent card: write `editionNote` and wrap the edition-specific passages in `<aside class="edition">`.
3. Write `en.md`: the 13 headings of BRIEF section 3, the dialogic style of section 6 (guiding questions, traps as question and answer, the `How it is studied:` block on a P0 card), a marker after each factual sentence, your own words and structure. While writing, compare each sentence with its source sentence for close paraphrase (section 2). Stay under `depth.maxWordsEn`.
4. Write the ledger: one row per marker, `section` = its anchor id, `statement` in your own English words, `sourceRef` with printed pages, `verifier: "author-agent"`, `status: verified` only for what you confirmed on the cited pages. Add `secondSource` only from `second-sources.md`; when it differs from the textbook use `sources-differ`, the aside in `en.md` and a review-queue row.
5. Write `meta.yaml` (BRIEF section 3): both languages, `lenses` and relations from `vocab.json` only, 3 `quickCheck` items, `sources` covering every source the ledger cites, `examQuestions: []`, `images: []`, `status: published`.
6. Write the fragments: sources copied from `second-sources.md`, review-queue rows, taxonomy gaps.
7. Run `npm run card:check -- <id> --stage author`. Fix, run again; at most two fixing rounds.
8. Write the report and return the JSON.

Return (exact; the same JSON goes to `.work/reports/<id>.author.json`):
```json
{ "id": "<id>", "stage": "author", "status": "done", "note": "<=200 chars", "files": ["src/content/entities/<id>/meta.yaml", "src/content/entities/<id>/en.md", "docs/ledger/<id>.yaml"], "claims": 0, "wordsEn": 0, "checkOk": true }
```

Stop and return `blocked` when:
- `source.txt` is empty or the reference has no section for this card (note `no-source`);
- you reach the tool-call cap;
- `card:check` still fails after two fixing rounds (name the gate);
- the word cap cannot be met without dropping a must-cover item the pages support (say which).
