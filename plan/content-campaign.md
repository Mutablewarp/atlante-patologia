# Content campaign: every chapter published

Goal (owner, 2026-11-13): all 35 modules published. Plan: `plan/v3-plan.md` §7 and §10. Contracts: `docs/agents/CONTRACTS.md`. Roles: `docs/agents/roles/`.
The lead is the session that runs this file. The cards are written by lean Sonnet 5.5 agents (`scripts/agent/run-batch.mjs`); the lead launches, checks, fixes, merges and reports. It does not write card text itself.

## State and scope

- Live before the campaign: 30 cards (26 of module `g01`, 4 of the pilot). Batch W02 (11 cards) is finished by another session: do not touch `../atlante-patologia-wt/w02-rest`.
- `.work/manifest.json` (private, built from the programme map) has 467 rows in batches W01–W24 for all 35 modules. Seven rows are of kind `pattern` and are skipped by the tools (they come later with the pattern pages).
- Released on 2026-11-13: batches W20 (`g06`, 22 cards), W21 (`g08`, `s10`, `s12`, `o34`, 20), W22 (`s13`, `o31`, 19), W23 (`o33`, 14) and W24 (`g09`, 14). They cover the eight modules that had no row and widen `g09`; the manifest now has 467 rows. These cards are outside the course programme: their lists come from the reference's chapter outlines, so check the first audit of each of these batches with extra care for must-cover items that the pages do not hold.
- W01 (`g10`, 13 cards of kind `technique` and 2 concepts) is not released: the reference has no pages for most of these cards, so they must be written from open second sources, and the pipeline does not do that yet (the author and the verifier stop on an empty `source.txt`). The orchestrator owes that variant. Skip W01 until this file says otherwise.
- Order: W03, W04, W05, W06, W07, W08, W09, W10, W11, W12, W13, W14, W15, W16, W17, W18, W19, W20, W21, W22, W23, W24, then W01 when released.

## Setup (once)

1. Worktree for the campaign: `git worktree add ../atlante-patologia-wt/content -b content/campaign main`, then inside it `ln -s ../../atlante-patologia/.work .work` and `npm ci`.
2. Read `docs/agents/BRIEF.md`, `docs/agents/CONTRACTS.md` §5–§8 and the last entries of `docs/PROGRESS.md` (the notes on the pilot and on W02: costs, audit method, defects found).
3. Do the tooling tasks below (C-1 to C-3) before the first merge; they can run while W03 is being written.

## One batch, step by step (run inside the campaign worktree; `B` is the batch, for example W03)

1. Start from a clean tree on the latest main: `git status --short` prints nothing; `git merge main`.
2. Write: `node scripts/agent/run-batch.mjs --batch B --max 40 --concurrency 4 --budget 90 > <log> 2>&1` in the background. It builds missing packets, then runs author, distance, translator, verifier, fixer, questions and scout for each card. Exit code 0 all done, 1 a card blocked, 3 usage limit. Run the same command again to resume; it restarts each card at its first stage without a done report.
   - Usage limit (exit 3): read the reset time, schedule your own wake-up after it, run the command again. Do not ask the owner.
   - Blocked card: read `.work/reports/<id>.<stage>.json` (and `<id>.<stage>.agent.json` when present). "wrote outside the card" with another card's files named: a false alarm of two cards running together, run the batch again. "no report": run it again. A real problem: run the stage alone with a note, `node scripts/agent/run-stage.mjs <id> <stage> --note "..."`. A card that blocks three times is left out of the batch and listed in `docs/REVIEW_QUEUE.md`.
3. Check: `node scripts/agent/audit-batch.mjs --batch B --audit 4` (read-only agents: coverage of every card, an audit of 15 claims in 4 cards). Act on each flag:
   - `card:check fails`: read its message, run the stage that owns the problem again with a note.
   - `must-cover item missing`: when the missing part is "not in the packet", confirm that the card's review-queue fragment has a `not-found-in-reference` row for it and go on; otherwise run the fixer with a note that names the item (a wider packet if needed: `node scripts/agent/packet.mjs <id> --extra "<printed pages>"`).
   - a question that names a missing claim or rests on a missing fact: run the `questions` stage again.
   - `audit found an error`: run verifier then fixer again on that card, then `audit-batch.mjs --batch B --only <id> --audit 1`.
   - Close paraphrase: read what the audit quotes before you act. A second verifier and fixer pass is not the default: in W02 it did not lower the audited count (10 of 60 before, 9 of 60 after) and it removed claims to fit the word cap, which left questions resting on removed facts. Sort the flagged sentences: copied wording or a copied list of items (BRIEF section 2 b and c) must be fixed; a fact of two or three steps in its natural order, a short definition or a standard term is allowed by BRIEF section 2 and is only counted. For the cards with sentences of the first sort run verifier and fixer once more with the note "Second pass. Facts are verified. Judge close paraphrase strictly, BRIEF section 2 a, b, c; fixes not longer than the sentence they replace; remove no claim.", then `questions` again for a card that lost a claim, then `audit-batch.mjs --only <ids> --audit <n>`. Write both counts and the sorting into the notes of the batch.
   - Stop rule: audit errors above 2 % of the audited claims after one repair round: stop the campaign and report to the owner.
4. Scout leftovers: no image file under `src/assets/images/` without its record in `src/content/images/`, and no record without its file (list both; delete only an image file that no record and no `meta.yaml` names).
5. Commit and close: `git merge main`; `AGENT_COAUTHOR="Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>" node scripts/agent/commit-finished.mjs --batch B`; `node scripts/agent/finalize-batch.mjs --batch B`; `node scripts/agent/sync-planned.mjs --write` and `node scripts/agent/module-status.mjs --write` (after C-1 and C-2 exist); commit the shared files (`chore(B): merge fragments, planned lists, module status`).
6. Gates: `npm run check`, `npm test`, `npm run build`, `npm run test:dist`, `npm run guard`, `npm run contrast`, `npm run no-verbatim`, `npm run test:e2e:linux` (Docker Desktop must run: `open -a Docker`). A red gate is fixed at its cause, never by loosening the gate.
7. Metrics: tokens of the batch = the sum of `input + cacheCreate + cacheRead + output` over the lines of `.work/usage.jsonl` whose `id` is a card of the batch; kB per card = the median size of `dist/it/e/<id>/index.html`. Then `node scripts/agent/metrics.mjs --batch B --cards <n> --tokens <sum> --audit-total <claims> --audit-wrong <errors> --kb-per-card <kB> --ci <result>` and three lines under it in `docs/PROGRESS.md`: cost in dollars, close paraphrases found by the audit, cards left out and why.
8. Merge and publish: merge into `main` (fast-forward or a merge commit), push, wait for CI (`gh run list --limit 3`), run the live smoke test (command in the memory note `project-body-3d.md`), check two new cards on the live site in both languages.
9. Tell the owner in five lines of Italian: batch, cards published, modules now complete, audit numbers, what was left out. Update the memory note of the campaign. Start the next batch.

While the gates and CI of one batch run, the next batch may be written in a second worktree (`../atlante-patologia-wt/content-b`, branch `content/campaign-b`, same setup): never two batches in one worktree, because the build reads every card on disk.

## Stop rules (plan §10)

Pause and report when: the cost per card at API prices (the sum of `costUsd` in `.work/usage.jsonl` over the cards of the batch, divided by the cards) passes $6 in two batches running (the plan's limit of 600 k tokens used another count and cannot be read from the log; the pilot and W02 cost $4.93 per card with their rework); the audit fails as in step 3; `dist/` passes 80 % of its budget (`docs/ARCHITECTURE.md`); `main` is red; a card would need a source outside the packet rules.
Cards stay `ai-generated-unreviewed`. Only a person sets `expert-reviewed`.

## Tooling tasks (coder agents: `node scripts/agent/run-task.mjs <id> --file plan/content-campaign.md`)

### C-1: planned lists from the manifest (coder)
Files: scripts/agent/sync-planned.mjs, tests/agent-sync-planned.test.ts
Goal: the site knows every planned card, so chapter progress and "planned" badges are true.
Do: `node scripts/agent/sync-planned.mjs [--write]` reads `.work/manifest.json` and `src/content/modules.yaml` (keep comments and order: edit with `parseDocument` from `yaml`, as `finalize-batch.mjs` does). For each module: a manifest row whose card is not published (`src/content/entities/<id>/meta.yaml` missing, or its `status` is not `published`) is in `planned` as `{ id, names: { it, en } }`; an entry whose card is now published is removed; entries of ids outside the manifest are kept. Rows of kind `pattern` are skipped. Without `--write` it prints what would change and exits 1 when something would. Export a pure function that takes the parsed inputs and returns the new lists.
Acceptance: `npx vitest run tests/agent-sync-planned.test.ts` with handwritten fixtures: adds, removes, keeps, idempotent on a second run.

### C-2: module status from the cards (coder)
Files: scripts/agent/module-status.mjs, tests/agent-module-status.test.ts
Goal: a module becomes `published` when every card planned for it is published.
Do: `node scripts/agent/module-status.mjs [--write]` prints one line per module: published cards, planned entries left, status. With `--write` it sets `status: published` on a module with at least one published card and an empty `planned` list, and never sets a module back to `planned`. Same editing rules as C-1. Run after C-1's sync.
Acceptance: `npx vitest run tests/agent-module-status.test.ts`: complete module flips, partial does not, empty module does not, a published module stays.

### C-3: chapter progress by cards on the home page (coder)
Depends: C-1
Files: src/pages/[lang]/index.astro, src/i18n/pages.ts, tests/e2e/nav.spec.ts
Goal: the home page shows real progress, not only finished modules.
Do: keep the modules line and add cards: "N cards published of M" in total and per section, where M = published cards + planned entries of the modules. Under it a compact list of the modules with `published/total` cards and the existing planned badge; a finished module links to its lens page. No new colour, no layout shift, both languages. One e2e check: the totals on the page equal the numbers computed from the page's own list.
Acceptance: `npx astro check` 0 errors; the lead runs the e2e suite.
