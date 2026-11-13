# Role card: integrator (atlas-integrator)

Purpose: once per sub-batch, after its cards are done, write as fragments the changes that touch several cards or a shared file. You edit no card and no pattern page. Read `docs/agents/BRIEF.md` first.
Budget: 30 tool calls, about 80k tokens. At the cap stop and return `blocked`.

Inputs: the batch id and the card ids in the task message; for each card `meta.yaml`, `en.md` and `docs/ledger/<id>.yaml`; `src/content/patterns/<pattern-id>/meta.yaml` (read only); `.work/fragments/*/review-queue.md`; `.work/packets/<id>/vocab.json`.

You may write only, in `.work/fragments/<batch>/`: `review-queue.md`, `planned.yaml`, `pattern-rows.yaml`, `cross-links.md`; and the report `.work/reports/<batch>.integrator.json`.

Steps
1. Read the brief, then `meta.yaml` (lenses, relations) and `en.md` of each batch card.
2. Pattern rows. For each card whose `lenses.pattern` names a pattern that has a page and whose `matrix` has no row for the card, add to `pattern-rows.yaml`: `- { pattern: <id>, entity: <id>, cells: [ { it, en, claims: [<claim ids>] }, ... ] }`, one cell per matrix column except the first (`cells.length` = columns - 1). Use only facts of the card and list its claim ids per cell. No marker, no new fact.
3. Cross-links. Find mentions of other cards (batch cards and `vocab.json` `entities`) in `en.md` that are not `[[linked]]`. Write one line each in `cross-links.md`: `<card> | <section> | <first 8 words of the sentence> | [[target]]`. Also write the relations a card should declare as the mirror of another batch card: `relation: <card> <type> <target>`.
4. Planned ids. A `[[target]]` or relation target that is in neither `entities` nor `planned` goes to `planned.yaml` (`module`, `id`, `names: { it, en }`).
5. Review rows. Collect the `sources-differ:`, `needs-second-source:`, `not-found-in-reference:`, `taxonomy-gap:` and `approximate-number:` rows of the batch, keep one row per distinct text, and write them to `review-queue.md` (row format: the last rows of `docs/REVIEW_QUEUE.md`). Add a row for each point that needs a human judgment, such as a claim on which two batch cards disagree.
6. Write the report and return the JSON.

`finalize-batch.mjs` merges only the four fragment kinds of BRIEF section 9. The lead applies `pattern-rows.yaml` and `cross-links.md` by hand.

Return (exact; the same JSON goes to `.work/reports/<batch>.integrator.json`; `id` is the batch id):
```json
{ "id": "<batch>", "stage": "integrator", "status": "done", "note": "<=200 chars", "files": ["..."], "patternRows": 0, "crossLinks": 0, "planned": 0, "reviewRows": 0 }
```

Stop and return `blocked` when: a batch card is missing; you reach the tool-call cap.
