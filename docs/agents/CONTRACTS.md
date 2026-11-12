# Agent pipeline contracts

Shared specification for the scripts in `scripts/agent/` (plan: `plan/v3-plan.md` §2, §4, §6). A script that does not match this file is wrong, or this file is: change both in the same commit.

General rules for every script here:

- Plain ESM (`.mjs`), no new dependency. Paths are relative to the repository root the script runs in.
- Reads and writes only `.work/`, `src/content/`, `docs/ledger/` and `src/assets/images/`, and only the paths named below.
- `.work/` is ignored by git. In a batch worktree it may be a symlink to the main checkout's `.work/`.
- Each script exports its pure functions and runs its CLI only when called directly (`if (process.argv[1] === fileURLToPath(import.meta.url))`), as `scripts/agent/manifest.mjs` does.
- Unit tests go in `tests/agent-<name>.test.ts`, on small handwritten fixtures. The reference text and the programme map are private, so a test never needs them; a test on the real files uses `describe.skipIf(!existsSync(...))`.
- Output is short: one summary line, or a JSON object of at most 30 lines. Details go to a file.

## 1. Paths

| Path | Content |
|---|---|
| `.work/manifest.json` | One row per planned card, from `scripts/agent/manifest.mjs`: `id, planned, block, names{it,en}, kind, tier, pages, priority, editionDependent, module, prog, batch, mustCover[], published` |
| `.work/fulltext.txt` | The reference text. Each PDF page starts with a line `=== PAGE N ===`. Printed page = N − 24 |
| `.work/packets/<id>/` | The packet of a card (§2) |
| `.work/reports/<id>.<stage>.json` | The report of one agent (§3) |
| `.work/state/<id>.json` | `{ id, stage, status, updated }`: the last recorded stage. Written by scripts only |
| `.work/fragments/<id>/` | Changes to shared files, written by agents (§6) |

Stages, in order: `author`, `translator`, `verifier`, `fixer`, `questions`, `scout`. `status` is `done` or `blocked`.

## 2. Packet: `node scripts/agent/packet.mjs <id> [--extra "<printed pages>"]`

Inputs: the manifest row, the reference text, `src/content/taxonomy/*.yaml`, `src/content/modules.yaml`, `src/content/entities/*`.

Writes `.work/packets/<id>/`:

- `row.json`: the manifest row plus `depth: { sections: [section ids], maxWordsEn: N }`, by priority:
  - P0 and tier core: all 13 sections, 1200 words;
  - P1 (or P0 extended): all 13 sections, 800 words;
  - P2: the six sections `definition`, `micro`, `diagnosis`, `differential`, `high-yield`, `traps`, 500 words.
  The section ids are those of `src/lib/sections.ts`; check the real ids and keep the six that match.
- `source.txt`: the pages of `row.pages` (and of `--extra`), each page preceded by a line `[p. N]` with N the printed page, in page order. `pages` is free text: take every number or range matching `\d+(–\d+)?` and ignore words and parentheses. At most 60,000 bytes: if the text is longer, drop pages from the end and finish with `[truncated: printed pages A-B not included]`. For `—` or `scattered` the file is empty and `NOTES.md` says that the reference has no section for this card.
- `vocab.json`: `{ taxonomy: { system: [ids], process: [...], pattern: [...], presentation: [...], marker: [...], group: [...] }, entities: [existing entity ids], planned: [ids in the planned lists of modules.yaml], modules: [ids] }`.
- `NOTES.md`, at most 20 lines: names, kind, priority, depth, a warning if `editionDependent`, the must-cover list, and the paths of the exemplar cards named in `docs/agents/BRIEF.md`.

Prints `packet <id>: <pages> pages, <bytes> bytes`. Exits 1, with the reason, when the id is not in the manifest.

## 3. Reports

Every agent writes `.work/reports/<id>.<stage>.json` and returns the same JSON, at most 2 kB:

```json
{ "id": "...", "stage": "author", "status": "done", "note": "at most 200 characters", "files": ["paths written"] }
```

The verifier adds `verdicts`: `[{ "claim": "<id>-c012", "verdict": "supported|partly-supported|unsupported|contradicted|close-paraphrase", "locator": "p. 41", "fix": { "en": "...", "it": "...", "ledger": "..." } }]`, where `fix` is present only when the verdict is not `supported`. The exact fields of each role are in its role card.

`node scripts/agent/record.mjs <id> <stage>` reads that report, checks the fields, and writes `.work/state/<id>.json`.

## 4. The check: `npm run card:check -- <id> [--stage <stage>|all]`

Prints a JSON object of at most 30 lines: `{ "id", "ok", "words": { "en", "it", "cap" }, "problems": [{ "gate", "where", "message" }], "more": N }`, with at most 15 problems shown (`more` counts the rest). Exit code 0 when `ok`.

Gates:

1. The content tests for one entity: `ENTITY=<id>` with `tests/content-one` (what `npm run validate:entity` runs). Each failing test becomes one problem with a message of at most 160 characters.
2. `node scripts/no-verbatim.mjs` on the card's files: `src/content/entities/<id>/`, `docs/ledger/<id>.yaml`, `src/content/images/<id>-*.yaml`. Skipped, with a note, when `.work/*.txt` is absent.
3. `it.md` has `translatedFrom` equal to the sha256 of `en.md`.
4. Claim markers `<!--c:...-->` in `en.md` and in `it.md` are the same list, and equal the `claimId`s of the ledger.
5. English words of `en.md` do not exceed the cap in the packet's `row.json`, when the packet exists.

With `--stage`, a gate that cannot apply yet is skipped: before `translator` there is no `it.md`; before `scout` there are no images.

## 5. Running a batch

- `node scripts/agent/next.mjs --batch W02 [--max 8]` prints `{ "packets": ".work/packets", "cards": [{ "id", "from" }] }`. `from` is the first stage with no `done` report. It takes cards in manifest order, P0 first, skips published cards and cards whose stages are all done, and builds the missing packets.
- `node scripts/agent/commit-finished.mjs [--batch W02]`: for each card whose six stages are `done` and whose `card:check` passes, stage exactly the card's files (the entity folder, the ledger, its image yaml and image files) and commit them as `feat(<id>): add the card (<kind>, <priority>)`, with the trailer given in the environment variable `AGENT_COAUTHOR`. A card that fails is skipped with a one-line reason. Never `git add -A`.
- `node scripts/agent/finalize-batch.mjs --batch W02`: rebuilds the entries of `src/lib/self-verified.ts` from the ledgers (rows whose `verifier` contains `author` or `fixer`, with exact counts; `tests/ledger-verifier.test.ts` checks them) and merges the fragments (§6). It prints a summary and commits nothing.
- `scripts/agent/content-batch.workflow.js` is the Workflow script for one sub-batch: the cards of `next.mjs`, one agent per card and stage, a blocked card stops while the others go on, results kept small.

## 6. Fragments

Agents never edit a shared file (`src/content/sources.yaml`, `src/content/modules.yaml`, `docs/REVIEW_QUEUE.md`, `docs/MISSING_ASSETS.md`, `src/lib/self-verified.ts`, any other doc). They write `.work/fragments/<id>/`:

- `sources.yaml`: entries in the format of `src/content/sources.yaml`;
- `review-queue.md`: rows in the format of `docs/REVIEW_QUEUE.md`;
- `missing-assets.md`: rows in the format of `docs/MISSING_ASSETS.md`;
- `planned.yaml`: ids to add to the `planned` list of a module in `modules.yaml`.

`finalize-batch.mjs` merges them: it keeps one entry per id and one row per distinct text.

## 7. Helper tools

- `node scripts/agent/commons-candidates.mjs --query "<text>" [--category "Category:..."] [--limit 30] [--min-width 800]` (plan I-7). Reads the Wikimedia Commons API: a search in the File namespace; with `--category` too, limited to that category (`incategory:`); with only `--category`, the files of the category. One request at a time, 1 s apart, at most 3, with the user agent `atlante-patologia-tooling/1.0 (https://github.com/Mutablewarp/atlante-patologia)`. Prints at most 30 JSON lines `{ title, pageUrl, fileUrl, width, height, bytes, license, licenseUrl, author, credit, description, allowed, reason }`, in the API's order; `description` and `credit` have at most 200 characters. `allowed` is true for public domain, CC0, CC BY and CC BY-SA of any version, with a named author. Any NC or ND licence, educational use, fair use, an unknown or missing licence and a missing or unknown author give `allowed: false` and a `reason`. Non-image files and files narrower than `--min-width` are left out. Writes nothing. Exit 2 on a bad option, 1 on a network or API error.
- `node scripts/agent/numbers-check.mjs <id>` (plan I-10). Reads `docs/ledger/<id>.yaml` and `.work/packets/<id>/source.txt`, and compares the numbers of each claim's `statement` (integers, decimals, thousands, percentages, both ends of a range) with the numbers on the pages named in its `sourceRef.pages`. Claim ids, page locators and dates are never read. Prints JSON of at most 30 lines `{ id, checked, skippedClaims, notFound: [{ claim, number }], more }`: `checked` counts numbers, `skippedClaims` counts claims whose pages are not in `source.txt`, `notFound` shows 20 rows and `more` (only when present) counts the rest. Advisory: a number written as a word is not seen. Always exit 0; a missing file or bad YAML gives a `note`.
- `node scripts/agent/metrics.mjs --batch W02 --cards 8 --tokens 3200000 --audit-total 40 --audit-wrong 1 --kb-per-card 380 --ci first-try [--file docs/PROGRESS.md]` (plan I-11). Appends one table row (batch, date, cards, tokens per card in thousands, audit error rate with its count, kB per card, CI result) under `## V3 batch metrics` at the end of `docs/PROGRESS.md`, creating the heading and the table header when missing, and prints the row. Writes only that file. Exit 2 on a missing or bad option.
