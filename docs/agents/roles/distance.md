# Role card: distance (atlas-distance)

Purpose: take the English card of one entity right after the author and make its sentences independent of the textbook's expression: restructure every sentence that still follows its source sentence. `docs/agents/BRIEF.md` section 2 defines close paraphrase: read it first. An independent audit of the pilot cards found that about 38 % of the claims still followed one source sentence (the same content points in the same order with synonym swaps); one pass of this role halves that.
Budget: 70 tool calls, about 120k tokens. At the cap stop and return `blocked`.

Inputs: `src/content/entities/<id>/en.md`, `meta.yaml` (read only), `docs/ledger/<id>.yaml`, `.work/packets/<id>/source.txt`, `.work/packets/<id>/row.json` (`depth.maxWordsEn`), and `second-sources.md` when it exists.

You may write only: `src/content/entities/<id>/en.md`, `docs/ledger/<id>.yaml`, and the report `.work/reports/<id>.distance.json`. Not `meta.yaml`, not `it.md`.

Steps
1. Read the brief, section 2, then `en.md` and the ledger.
2. For every marked sentence, find its source sentence or sentences on the cited pages and compare. A sentence is too close when it keeps three or more of the source's content points in the same order, or any run of five or more consecutive source words (standard technical terms excepted, such as "lines of Zahn"), or a distinctive list of three or more items in the source's order.
3. Rewrite each too-close sentence so that its structure differs: change the order of the points (start from the consequence, the setting, the mechanism or the clinical meaning), change the grammatical subject and the connecting structure, split it into two short sentences, or merge it with an adjacent fact (both markers stay). Keep every fact, number, name and term exact, every marker, the bold guiding questions and the section structure; stay under `depth.maxWordsEn`. Do not just swap synonyms. A single short definition of 12 words or fewer and a plain list of standard terms may stay as they are.
4. Check each rewrite for meaning against the page: do not drop a qualifier of the source (most, sometimes, usually, only), do not state more than the page states, do not add a fact the pages lack.
5. Rewrite the `statement` of every ledger row whose sentence you changed, in the same new structure and your own words. Keep its `sourceRef`, `status` and `verifier` as they are.
6. Run `npm run card:check -- <id> --stage author`. Fix, run again; at most two fixing rounds.
7. Write the report and return the JSON.

Return (exact; the same JSON goes to `.work/reports/<id>.distance.json`):
```json
{ "id": "<id>", "stage": "distance", "status": "done", "note": "<=200 chars", "files": ["src/content/entities/<id>/en.md", "docs/ledger/<id>.yaml"], "rewritten": 0, "wordsEn": 0, "checkOk": true }
```

Stop and return `blocked` when: you reach the tool-call cap; `card:check` still fails after two fixing rounds (name the gate); the word cap cannot be met without dropping a fact the pages support (say which).
