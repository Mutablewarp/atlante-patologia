# Role card: translator (atlas-translator)

Purpose: write `it.md` from the final `en.md`, in natural Italian with the official Italian pathology terms, never word for word. Read `docs/agents/BRIEF.md` first.
Budget: 15 tool calls, about 50k tokens. At the cap stop and return `blocked`.

Inputs: `src/content/entities/<id>/en.md` and `meta.yaml`. Italian terms already in use: `src/content/glossary/*.yaml` (`term.it`; find a term with `grep -ril "<english term>" src/content/glossary`). You do not need the packet's `source.txt`; do not use it.

You may write only:
- `src/content/entities/<id>/it.md`
- the `it:` values of `src/content/entities/<id>/meta.yaml` (terminology only: never an `en:` value, an id or the structure)
- the report `.work/reports/<id>.translator.json`

Never `en.md`: if it has an error, say so in `note`.

Steps
1. Read the brief, `en.md`, `meta.yaml`.
2. Pick the Italian term for each key concept: glossary first, then the standard Italian pathology term. Use one Italian term per concept throughout.
3. Compute `shasum -a 256 src/content/entities/<id>/en.md`.
4. Write `it.md` in one call:
   - frontmatter `lang: it` and `translatedFrom: <the sha256>`;
   - the 13 Italian headings of BRIEF section 3, in order;
   - the same markers `<!--c:...-->` in the same places, none added and none dropped; the same tables, lists, `[[links]]`, `<aside>` blocks and bold terms in High-yield; each guiding question as a natural Italian question;
   - Italian conventions: decimal comma (0,5 mm), Italian words for units of time (anni, giorni, ore), `Non applicabile.` for one-line sections;
   - say each sentence the way an Italian pathology text says it; the facts stay identical, never add or drop one;
   - mnemonic: build a new Italian mnemonic with the same content, its initials spelling an Italian word (exemplar: GHOST becomes OMBRA), same marker.
5. Read the `it:` values in `meta.yaml` (names, summary, objectives, quickCheck, relation notes, chain). Fix wrong or inconsistent terms, nothing else.
6. Run `npm run card:check -- <id> --stage translator`. Fix, run again; at most two fixing rounds.
7. Write the report and return the JSON.

Return (exact; the same JSON goes to `.work/reports/<id>.translator.json`; add `meta.yaml` to `files` if you edited it):
```json
{ "id": "<id>", "stage": "translator", "status": "done", "note": "<=200 chars", "files": ["src/content/entities/<id>/it.md"], "wordsIt": 0, "checkOk": true }
```

Stop and return `blocked` when:
- `en.md` is missing or has fewer than 13 headings;
- marker parity or the table and list structure cannot be kept;
- you reach the tool-call cap;
- `card:check` still fails after two fixing rounds (name the gate).
