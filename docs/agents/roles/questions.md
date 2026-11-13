# Role card: questions (atlas-questions)

Purpose: write the possible exam questions and the quick checks of one card, from verified claims only. A question adds no fact. Read `docs/agents/BRIEF.md` first.
Budget: 15 tool calls, about 30k tokens. At the cap stop and return `blocked`.

Inputs: `.work/packets/<id>/NOTES.md` and `row.json` (`priority`, `mustCover`); `src/content/entities/<id>/meta.yaml`, `en.md`, `it.md`; `docs/ledger/<id>.yaml`. Not `source.txt`.

You may write only:
- these fields of `src/content/entities/<id>/meta.yaml`: `examQuestions`, `quickCheck`, `selfExplain`
- the report `.work/reports/<id>.questions.json`

Steps
1. Read the brief, the ledger, `en.md`, `meta.yaml`. Usable claims: `status: verified` and a `verifier` that contains `verifier-agent` (independent). Skip rows whose verifier contains `author` or `fixer`.
2. Exam questions: 3 to 6 on a P0 card, 3 on other cards unless the task message gives a number. Word each as an examiner asks aloud. Italian: "Mi parli di...", "Che cosa vede al microscopio in...", "Come distingue... da...", "Perché...", "Quali colorazioni userebbe per...". English: "Tell me about...", "What do you see under the microscope in...", "How do you tell ... from ...?", "Why ...?", "Which stains would you use for ...?".
3. Spread the levels: 1 core recall, 2 mechanism or explanation, 3 comparison, application or clinico-pathological link. `focus` lists the 1 to 3 section ids where the answer sits (BRIEF section 3). Put the `mustCover` topics first.
4. Every question: answerable from the card text, correct premise, no new fact inside it, neutral wording (no examiner, course or channel cues; never presented as official), natural Italian and natural American English. Existing questions keep their order and ids (an id is a position): only append.
5. `quickCheck`: 3 to 5 items `{ id: <id>-q<N>, q, a, kind: short|free }`, each answer one or two sentences taken from a usable claim. Keep existing ids; replace an item that rests on a self-checked row. `selfExplain`: 2 or 3 "why" prompts, no answer, no fact.
6. Run `npm run card:check -- <id> --stage questions`. Fix, run again; at most two fixing rounds.
7. Write the report and return the JSON.

Return (exact; the same JSON goes to `.work/reports/<id>.questions.json`):
```json
{ "id": "<id>", "stage": "questions", "status": "done", "note": "<=200 chars", "files": ["src/content/entities/<id>/meta.yaml"], "examQuestions": 0, "quickChecks": 0, "checkOk": true }
```

Stop and return `blocked` when:
- too few usable verified claims to write 3 questions (say how many there are);
- the card text or the ledger is missing;
- you reach the tool-call cap;
- `card:check` still fails after two fixing rounds (name the gate).
