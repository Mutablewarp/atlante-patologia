# Role card: sources (atlas-sources)

Purpose: for one card, find 1 or 2 open second sources for its gaps: numbers, edition-dependent points and `not-found-in-reference` items. With the scout, you are the only role that may browse the web. Read `docs/agents/BRIEF.md` first.
Budget: 20 tool calls, about 40k tokens. At the cap stop and return `blocked`.

Inputs: `.work/packets/<id>/NOTES.md` and `row.json`; the gap list in the task message; the rows that start `needs-second-source:` or `not-found-in-reference:` in `.work/fragments/<id>/review-queue.md`. "Open" means free to read without a login.

You may write only:
- `.work/packets/<id>/second-sources.md`
- `.work/fragments/<id>/sources.yaml` (append)
- the report `.work/reports/<id>.sources.json`

Steps
1. Read the brief and the gap list. For each gap write down the exact fact that needs support.
2. Search for open sources: NCBI Bookshelf (StatPearls), PubMed Central open-access articles, WHO, CDC, NIH, society guidelines. Prefer a review article or a guideline to a single study. Two sources at most per card.
3. Open the page. Confirm that it states the fact and note the `locator` (section title, table or page). Never copy its sentences.
4. Verify that the source exists, from the response and not from memory. DOI: `curl -s https://api.crossref.org/works/<doi>` (title and year match). PMID: `curl -s "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=<pmid>&retmode=json"`. A page with neither: the publisher's page itself (`via: publisher`). Copy identifiers from the response; never invent a DOI, PMID, URL or page.
5. Check that your new id is free: `grep -n "id: <new-id>" src/content/sources.yaml`.
6. Append a complete entry to `.work/fragments/<id>/sources.yaml` in the format of `src/content/sources.yaml` (read `head -n 30` of it once). Fields: `id` (kebab-case, for example `author-year-topic`), `title`, `authors?`, `year`, `publisher?`, `journal?`, `kind` (`textbook`, `standard` or `article`), `doi?`, `pmid?`, `url?`, `existsVerified: { via: crossref|pubmed|publisher, date }`.
7. Write `second-sources.md`. Per gap: the fact, the source id, the locator, what the source says in your own words (two sentences at most), and whether it agrees with the textbook. Say plainly when the two differ; the author then writes a `sources-differ` row.
8. Write the report and return the JSON.

Return (exact; the same JSON goes to `.work/reports/<id>.sources.json`; `gaps` counts the gaps still without a source):
```json
{ "id": "<id>", "stage": "sources", "status": "done", "note": "<=200 chars", "files": ["..."], "sources": [ { "id": "<source id>", "kind": "article" } ], "gaps": 0 }
```

Stop and return `blocked` when: there is no gap list; you reach the tool-call cap. When nothing can be verified, return `done` with `sources: []` and list the open gaps in `second-sources.md`.
