# V3 plan: finish the cards with Sonnet 5.5 agents, then the interactive body

Status: proposed on 2026-11-12, waiting for the owner's approval. It replaces the batch pipeline of `plan/v2-plan.md` for batches W01–W19. The evidence behind it is the private review of 2026-11-12 (`private/reviews/`).

## In breve (per il proprietario)

- **Problema.** Il metodo usato finora costa circa 1,7 milioni di token a scheda. Per 378 schede nuove non regge, e il sito supererebbe il suo limite di peso.
- **Idea.** Gli agenti Sonnet 5.5 ricevono compiti piccoli e chiusi. Tutto ciò che è meccanico lo fa uno script. Lo stato sta su disco, così un'interruzione non fa perdere nulla.
- **Obiettivo.** Al massimo 450.000 token a scheda, 8 schede per finestra d'uso, un commit per scheda.
- **Ordine.**
  1. Chiudere V2.2 e mettere in sicurezza il lavoro (Fase 0).
  2. Costruire gli attrezzi per gli agenti e provarli su 4 schede (Fase 1).
  3. Scrivere le 378 schede in lotti da 8 (Fase 2).
  4. Costruire il corpo 3D in parallelo, da subito dopo la Fase 1 (Fase 3): ogni lotto d'organo "accende" il suo organo.
  5. Collegare il corpo allo studio: progresso per organo, ripasso, orale (Fase 4).
- **Cosa ti chiedo.** Otto decisioni, elencate al §11.

## 1. Targets

| Metric | V2.2 (measured) | Target | Measured by |
|---|---|---|---|
| Agent tokens per card | about 1.7 M, enrichment only | ≤ 450 k | `subagent_tokens` of a run ÷ cards finished |
| Cards finished per usage window | about 4 | ≥ 8 | same |
| Work at risk without a commit | 296 files for 5 days | at most one sub-batch (8 cards) | commit script |
| Built image weight per card | about 3.7 MB (estimate) | ≤ 450 kB | per-card budget test |
| HTML per card page | 127–153 kB | ≤ 110 kB | budget test |
| Red pushes to `main` | 3 of 4 | 0 | Linux e2e before each push |
| Claims with an open second source | 1.7 % | every edition-dependent card and every numeric claim on new cards | ledger script |
| Audit error rate | not measured | ≤ 2 % of sampled claims per sub-batch | audit sheet |

The targets are goals, not measurements. The pilot (C-0) calibrates them.

## 2. Rules for Sonnet agents

1. **One agent, one card, one stage.** No agent edits a shared file (`sources.yaml`, `modules.yaml`, queues, `self-verified.ts`, any doc). Shared changes go into a fragment file; a script merges them.
2. **Inputs are three files.** `docs/agents/BRIEF.md` (≤ 150 lines), the role card, and the card's packet. Agents do not read `docs/*.md`, the full reference text, `node_modules`, `dist` or other cards. The brief names one exemplar card per kind.
3. **The packet holds the source.** A script cuts the cited page ranges out of the private reference text, with a `[p. N]` marker per page. Authors and verifiers never search the whole book and never browse the web.
4. **Scripts do the mechanical work.** Hashes, dates, claim numbering, marker parity, schema checks, the copy check, image resizing, merges and commits are scripts.
5. **One check command.** `npm run card:check -- <id>` prints at most 30 lines of JSON. An agent runs it, fixes, and runs it again at most twice. Then it returns `blocked` with the reason.
6. **Small returns.** An agent returns at most 2 kB of JSON: id, stage, status, path of its report file, one short note. Long notes go into the report file.
7. **Caps.** Each role has a tool-call cap (§3). At the cap the agent stops and returns `blocked`.
8. **No invention.** If the packet does not cover a "must cover" item, the agent writes a `not-found-in-reference` fragment and moves on. Numbers need a ledger row with a page.
9. **English first.** `en.md` is the source of truth. The translator writes `it.md` from it with the glossary. A script sets `translatedFrom`.
10. **Never** `git checkout`, `restore`, `reset`, `stash` or `clean`, and no commits: the lead's script commits.
11. **Naming rule.** No teacher, channel, course code or university name in any file.

## 3. Roles

Each role is an agent definition in `.claude/agents/` with `model: sonnet`, a short system prompt (the role card) and only the tools it needs.

| Role | Job | Writes | Tool-call cap | Token target |
|---|---|---|---:|---:|
| `atlas-author` | `en.md`, ledger rows and `meta.yaml` for one card, from its packet | the card's own files | 40 | 150 k |
| `atlas-translator` | `it.md` from `en.md`, with the glossary | `it.md` | 15 | 50 k |
| `atlas-verifier` | Fresh context. One verdict per claim against the packet. Never edits the card | report file | 30 | 100 k |
| `atlas-fixer` | Applies the verifier's report, in both languages | the card's own files | 25 | 60 k |
| `atlas-questions` | Exam questions and quick checks, from verified claims only | `meta.yaml` | 15 | 30 k |
| `atlas-scout` | Picks at most 3 images from the candidate list, writes their yaml and annotations | image files and yaml | 30 | 60 k |
| `atlas-sources` | Only for edition-dependent cards and gaps: finds 1–2 open second sources | packet file | 20 | 40 k |
| `atlas-integrator` | Once per sub-batch: pattern-page rows, cross-links, review-queue rows that need judgment | fragments | 30 | 80 k |
| `atlas-coder` | One infrastructure or body task: tests first, at most 300 changed lines | code on a task branch | 60 | 150 k |

The lead is the main session, on the strongest model. It builds packets, launches runs, audits a sample, merges and pushes. It writes no card text.

Author, translator, verifier, fixer, questions and scout add up to 450 k tokens per card.

## 4. Pipeline and state

**Stages per card:** packet (script) → author → check → translator → check → verifier → fixer → check → questions → scout → check → commit (script).

**State lives on disk**, in the main checkout's ignored `.work/`:

- `.work/manifest.json`: one row per planned card (I-2).
- `.work/packets/<id>/`: the packet (I-3).
- `.work/reports/<id>.<stage>.json`: each agent's report.
- `.work/state/<id>.json`: last finished stage, status, date.

**A run is one sub-batch of 8 cards**, sized to finish inside one usage window.

1. `node scripts/agent/next.mjs --batch W02 --max 8` prints the args: the cards and the first stage each still needs.
2. The lead launches the workflow below with those args.
3. After the run, scripts commit each finished card (one commit per card), merge fragments, and run the gates.
4. A resume is step 1 again. Nothing is embedded in the workflow script.

```js
export const meta = {
  name: 'content-batch',
  description: 'One sub-batch of cards on Sonnet agents: author, translate, verify, fix, questions, images',
  phases: [{ title: 'Cards' }],
}
const STAGES = ['author', 'translator', 'verifier', 'fixer', 'questions', 'scout']
const OUT = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    stage: { type: 'string' },
    status: { type: 'string', enum: ['done', 'blocked'] },
    report: { type: 'string' },
    note: { type: 'string' },
  },
  required: ['id', 'stage', 'status'],
}
const run = (stage) => (prev, card) => {
  if (!prev || prev.status === 'blocked') return prev // a blocked card stops; the others go on
  if (STAGES.indexOf(stage) < STAGES.indexOf(card.from)) return { id: card.id, stage, status: 'done' }
  return agent(
    `Card ${card.id}, stage ${stage}. Packet: ${args.packets}/${card.id}/. Follow your role card. Return the JSON only.`,
    { label: `${stage}:${card.id}`, phase: 'Cards', agentType: `atlas-${stage}`, model: 'sonnet', schema: OUT },
  )
}
return pipeline(args.cards, ...STAGES.map(run))
```

## 5. Phase 0: close V2.2 and stabilise

| Id | Task | Who | Done when |
|---|---|---|---|
| P0-1 | Checkpoint the V2.2 branch | lead | Done: `aab6b06` |
| P0-2 | Run the last 6 fixes and the batch closing on Sonnet (the script resumes; add `model: 'sonnet'`). Then gates, merge into `main`, deploy, live smoke test | agents, lead | V2.2 live; `docs/PROGRESS.md` updated |
| P0-3 | Merge `fix/quiz-target-size` (`66087c0`) | lead | Study e2e passes 20 times in a row |
| P0-4 | Remove the 34 merged or patch-equivalent worktrees (19 GB). Keep `g01-v22` and the quiz one until merged | lead, after the owner confirms | Done 2026-11-12: `git worktree list` shows 3 entries |
| P0-5 | `npm run test:e2e:linux`: the e2e suite in the Playwright Docker image, pinned to the installed Playwright version. `npm run prepush` runs the gates plus this. Add one entity page to the CI Lighthouse list | coder | A known Linux-only failure reproduces locally; no push without it |
| P0-6 | The 6 pathways and 4 diagrams deferred from V2.2 | agents | Run as sub-batch W00b after the pilot |

## 6. Phase 1: agent infrastructure

Each row is one `atlas-coder` task with tests. The lead reviews every diff.

| Id | Task | Done when |
|---|---|---|
| I-1 | `docs/agents/BRIEF.md` and the nine role cards in `.claude/agents/`. One exemplar card per kind, rewritten in the dialogic style | A no-op agent run reports its first-turn input tokens; the number is recorded in `docs/VERIFIED_FACTS.md` |
| I-2 | `scripts/agent/manifest.mjs`: parses the private programme tables into `.work/manifest.json` (id, names, kind, tier, priority, module, batch, pages, must-cover, edition flag) | 378 rows, unique ids, counts per batch equal the programme's |
| I-3 | `scripts/agent/packet.mjs <id>`: `row.json`, `source.txt` (page ranges with `[p. N]` markers, at most 60 kB), `vocab.json` (allowed lens terms, organ ids, linkable ids), exemplar pointer | Packets build for all W02 cards; nothing under `.work/` is tracked |
| I-4 | `npm run card:check -- <id>`: validator, schema, marker parity, `translatedFrom`, copy check for that card, image yaml | At most 30 lines of JSON; fails on a seeded defect of each kind |
| I-5 | `next.mjs`, `commit-finished.mjs`, `finalize-batch.mjs` (merges fragments, rebuilds `self-verified.ts` from the ledgers) and the workflow of §4 | A dry run on 2 fixture cards resumes after a forced stop without repeating a stage |
| I-6 | Site weight. Images: spike on 10 existing images (AVIF against WebP, 2 widths, a zoom source only where the viewer needs it), then a per-card budget test; re-encode the g01 images the same way. HTML: a card page is 127–153 kB; on one measured card about 61 kB is markup and 29 kB text, spread over the page (the chapter index is only 5 kB). Set a per-page budget and trim markup where it is cheap | Decision D8 taken; projection for 404 cards under the budget; both budget tests in CI |
| I-7 | `scripts/agent/commons-candidates.mjs`: queries the Wikimedia Commons API by category and returns candidates with licence, author and size, filtered to the allowed licences | The scout picks from a list instead of browsing |
| I-8 | Schema: `kind: technique`, module `g10`, section mapping for technique cards | Owner decision D2 taken; validator tests pass |
| I-9 | Schema for the body: `src/content/anatomy.yaml` (organ nodes under the 18 anatomical `system` terms), optional `sites` in `meta.yaml` (organ id plus the claim id that supports it), default from `lenses.system` | Validator and unit tests pass; lands before W04 |
| I-10 | Numbers check: flags a number in a claim that does not appear on the cited pages | Advisory list in the verifier's packet |
| I-11 | `scripts/agent/metrics.mjs`: appends one row per sub-batch to `docs/PROGRESS.md` (tokens per card, audit error rate, kB per card, CI first-try result) | Row written after the pilot |

**Site weight at 404 cards (estimate from today's build).** Images after the diet about 180 MB; HTML about 80–100 MB (808 card pages at 100–125 kB); search index about 11 MB. That is about 275–295 MB before the body assets: at the edge of the brief's 300 MB budget. At V2.2's image density (about 6 per card) and today's encoding, the images alone would pass 1 GB, which is GitHub Pages' limit.

## 7. Phase 2: content (378 cards)

**C-0, pilot.** Four W02 cards (one process, two diseases, one edition-dependent) through the whole pipeline. Go on only if tokens per card ≤ 600 k and the audit error rate ≤ 2 %. Otherwise fix the briefs or the scripts first.

**Order.** The programme's batch order (W01–W19), P0-core cards first inside each batch. W01 (methods) starts when D2 is decided; the pilot uses W02 because the reference covers it best.

**Depth** (owner decision D1):

| Priority | Sections | English words |
|---|---|---:|
| P0 core | all 13 | ≤ 1,200 |
| P1 | all 13, short | ≤ 800 |
| P2 | definition, morphology, diagnosis, differential, key points, traps | ≤ 500 |

**Dialogic style, made concrete.** Each section opens with one guiding question in bold and answers it. Traps are written as question and answer. Every P0 card has a "how to study it" block. The exemplar in the brief is the standard.

**Per card:**

- 3–6 exam questions on P0 cards, built from verified claims.
- At most 3 images: one gross, up to two micro. Diagrams only where a mechanism needs one.
- `sites`: the organs where the lesion occurs, each with its supporting claim id.
- Edition-dependent cards (79) and numeric claims need an open second source.

**A sub-batch is done when:** every card passes `card:check`; the audit passed; fragments are merged; gates and Linux e2e pass; it is merged, deployed and smoke-tested; the metrics row is written.

## 8. Phase 3: the interactive body

### 8.1 What the learner does

1. Opens the body: a translucent shell with the organs inside, and the 18 systems as chips.
2. Picks a system: its organs light up, the rest fades.
3. Picks an organ: a panel lists its lesions, grouped by process, with counts and the learner's progress. Planned cards show greyed.
4. Picks a lesion: a short preview, then the card.
5. From any card, "where in the body" shows the organs in `sites`. A general process lights up every organ it typically affects.
6. Later: one path from body to organ, gross photo, micrograph and molecule, reusing the image viewer and the molecular viewer.

### 8.2 Data

- `src/content/anatomy.yaml`: about 50 organ nodes, each under one `system` term, with labels in both languages and the mesh names it owns.
- `sites` in each card's `meta.yaml`; without it the card maps to the organs of its `system` terms.
- `src/lib/anatomy.ts`: card → organs, organ → cards (published and planned).

### 8.3 Assets

Licences checked at the source on 2026-11-12:

| Source | Licence | Use |
|---|---|---|
| BodyParts3D (Database Center for Life Science) | CC BY 4.0; licence page last updated 2025-02-27 | Primary: whole body in one coordinate frame |
| HRA 3D Reference Object Library (humanatlas.io) | CC BY 4.0, GLB files | Organs where it has better meshes |
| Z-Anatomy | CC BY-SA 4.0 | Fallback only |

Required credit for BodyParts3D: "BodyParts3D, © The Database Center for Life Science licensed under CC Attribution 4.0 International".

`scripts/anatomy/build-body.mjs` selects parts, merges them per organ, simplifies and compresses them, and writes:

- `public/anatomy/shell.glb`: the body shell, ≤ 400 kB, loaded first;
- one GLB per system, ≤ 500 kB each, loaded when the system is picked;
- `manifest.json`: mesh name → organ id;
- poster images rendered at build time, for the first paint and for browsers without WebGL.

Source, version, licence, credit and changes are recorded like image licences.

### 8.4 Viewer

- `<ap-body>` custom element, the same pattern as the image and structure viewers.
- three.js is imported only when the viewer is used. The page works before it loads.
- Picking by ray against named meshes; highlight by colour; camera moves only when motion is allowed.
- The selected organ is in the URL, so Back and links work.
- Assets are self-hosted and cached on first use; an offline pack includes them.

### 8.5 Accessibility and fallbacks

- The server-rendered tree (system → organ → cards) is the primary interface and the no-JavaScript view. The canvas mirrors its selection.
- Every action has a button: rotate, zoom, reset, next organ. No action needs a drag.
- No auto-rotation. Reduced motion removes camera flights.
- Without WebGL the page shows the poster and the tree.

### 8.6 Tests and budgets

- Unit: every organ has a mesh; every card resolves to at least one organ or to "general".
- e2e: tree and canvas stay in sync; keyboard path; no-WebGL path; reduced motion; no layout shift; axe.
- Budgets: shell and per-system sizes above; the viewer chunk measured and pinned in B-0; Lighthouse ≥ 90 on the body page.

### 8.7 Tasks

| Id | Task | Done when |
|---|---|---|
| B-0 | Spike: build 5 organs from the chosen source; measure sizes before and after simplification, the three.js chunk, and frame rate at tablet size; write `docs/BODY_SPEC.md` (≤ 200 lines) | Facts pinned in `docs/VERIFIED_FACTS.md`; owner decision D5 taken |
| B-1 | Data model: `anatomy.yaml`, `sites`, `src/lib/anatomy.ts` (with I-9) | Unit tests pass |
| B-2 | Body page without 3D: the tree with counts, planned cards greyed, search-indexed | e2e and axe pass; useful on its own |
| B-3 | Asset pipeline | Budgets met; licence records written |
| B-4 | Viewer core: lazy load, shell, system selection, highlight, buttons, sync with the tree, fallback | e2e passes on Chromium and WebKit |
| B-5 | Picking and the organ panel; URL state | Back restores the selection |
| B-6 | "Where in the body" on cards | Works on a general-pathology card and on an organ card |
| B-7 | Progress on the body: seen, mastered and due per organ; "review this organ" starts a filtered session | Reads the existing learner database; no new storage |
| B-8 | Design polish, accessibility review, performance pass, real iPad check | Reviews closed; owner checks on an iPad |

### 8.8 Sequencing

B-0 to B-2 start right after Phase 1, in parallel with W02–W03: they touch other files. The viewer is live before W04 (heart) merges, so each organ batch lights up its organ.

## 9. Phase 4: immersion and study

- Progress map: the body shows what the learner has explored and what is due today.
- Oral exam and quiz filtered by organ.
- The body-to-molecule path (8.1, step 6).
- A test with 5 students: can they find a lesion from the body, and do they come back? (Owner.)

## 10. Quality control

- **Audit.** After each sub-batch the lead re-reads 10 % of the claims (at least 12) against the packets. More than 2 % wrong: the sub-batch is verified again with a stricter brief.
- **Stop rules.** Scaling pauses when tokens per card exceed 600 k in two sub-batches running, when the audit fails, when `dist/` passes 80 % of its budget, or when `main` is red.
- **Human review.** Stays the only way to set `expert-reviewed`. The plan does not claim it.

## 11. Owner decisions

| Id | Decision | Recommendation |
|---|---|---|
| D1 | Card depth | The three levels of §7 |
| D2 | Technique cards for W01 | Add `kind: technique` with the section mapping proposed in the programme map |
| D3 | Human review | Name a reviewer and a first set of cards, or accept "not reviewed" on every card |
| D4 | Worktree cleanup (19 GB) | Remove the 34 merged ones (done 2026-11-12) |
| D5 | Anatomy source | BodyParts3D, plus HRA organs where needed |
| D6 | When to build the body | Right after Phase 1, not at the end |
| D7 | Where the body lives | The Atlas's opening view on tablets and computers; a highlighted card on phones |
| D8 | Site weight budget | Do the image diet and raise the project's own budget from 300 MB to 400 MB (GitHub Pages allows 1 GB) |

## 12. Not verified

- Sonnet 5.5 usage limits and its real tokens per card: the pilot measures them.
- Whether a custom agent type lowers the base context of each agent, and by how much (I-1 measures it). If it does not, the owner turns off unused plugins for this project.
- three.js chunk size, mesh quality after simplification, female pelvic organs in BodyParts3D, frame rate on a real iPad (B-0 and B-8).
- AVIF savings on micrographs, and how much markup can be trimmed (I-6).
- The Playwright Docker image on this Mac's architecture (P0-5).
- The medical correctness of existing cards: this plan changes the method, it does not re-check them.
