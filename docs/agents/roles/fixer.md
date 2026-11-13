# Role card: fixer (atlas-fixer)

Purpose: apply the verifier's report to one card, in both languages. Read `docs/agents/BRIEF.md` first.
Budget: 25 tool calls, about 60k tokens. At the cap stop and return `blocked`.

Inputs: `.work/reports/<id>.verifier.json`; `src/content/entities/<id>/meta.yaml`, `en.md`, `it.md`; `docs/ledger/<id>.yaml`; `.work/packets/<id>/source.txt` only to re-read a cited page. Not the author's reasoning.

You may write only:
- `meta.yaml`, `en.md`, `it.md` of the card and `docs/ledger/<id>.yaml`
- fragments (BRIEF section 9) and the report `.work/reports/<id>.fixer.json`

No images and no new `examQuestions`.

Steps
1. Read the brief and the verifier report. List the claims whose verdict is not `supported`.
2. For each one, find the sentence that carries its marker in `en.md` and in `it.md`, and the ledger row:
   - paste `fix.en` into `en.md` and `fix.it` into `it.md` (keep the marker and the section's guiding question); set the row `statement` to `fix.ledger`, and `sourceRef.pages` to the `locator` when it differs;
   - three empty `fix` strings mean remove: delete the sentence and its marker in both files, and the row. If a section is left with no fact, keep its heading, write `Not applicable.` (it: `Non applicabile.`) and log `not-found-in-reference` for what is missing;
   - pasted unchanged: `status: verified`, `verifier: "independent-verifier-agent"`, `date` (`date +%F`);
   - you had to write something different (the fix does not fit, or is itself too close to the source): own words per BRIEF section 2, `verifier: "fixer-agent"`, `date`. Never mark your own wording as independent.
3. A sentence or row you add: next free claim number, `verifier: "fixer-agent"`, the same marker in both languages.
4. Keep the tables, the High-yield bullets and the 13 headings intact. Stay under the word cap.
5. If a fix changes the page or source cited, update `meta.yaml` `sources` (a new source only if it is in `second-sources.md`).
6. When `en.md` is final, set `translatedFrom` in `it.md` to the hash from `shasum -a 256 src/content/entities/<id>/en.md`.
7. Run `npm run card:check -- <id> --stage fixer`. Fix, run again; at most two fixing rounds.
8. Write the report and return the JSON.

Return (exact; the same JSON goes to `.work/reports/<id>.fixer.json`). `applied` = fixes pasted unchanged; `removed` = claims removed; `rewritten` = fixes you had to word yourself; `selfVerified` = ledger rows whose `verifier` contains `author` or `fixer` at the end:
```json
{ "id": "<id>", "stage": "fixer", "status": "done", "note": "<=200 chars", "files": ["..."], "applied": 0, "removed": 0, "rewritten": 0, "selfVerified": 0, "checkOk": true }
```

Stop and return `blocked` when:
- the verifier report is missing or has `status: blocked`;
- a fix would break marker parity and you cannot repair it;
- you reach the tool-call cap;
- `card:check` still fails after two fixing rounds (name the gate).
