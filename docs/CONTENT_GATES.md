# Content gates

Content gates are Vitest suites in `tests/content/`. They run on the real `src/content` tree and `docs/ledger/` (`real.test.ts`). Any problem fails `npm test`. To run only these suites, use `npm run test:content`.

`fixtures.test.ts` shows that each gate fails. It loads a valid synthetic tree (`tests/fixtures/content-gates/`), checks that it passes, and then mutates one thing per test.

Code: `tests/content/tree.ts` (loader), `markdown.ts` (frontmatter, H2s, markers, numeric sentences), `gates.ts` (one function per gate). Gates are pure functions over the loaded tree.

Folders whose name starts with `_` (for example `_fixture-demo`) are template fixtures. Parity and numbers still apply to them. Reference checks skip them, because their relation targets are placeholders on purpose.

| # | Gate | Fails when | Scope |
|---|---|---|---|
| 0 | schema | a document does not match its Zod schema (`src/lib/schema.ts`), or `meta.id` ≠ folder name | all |
| 1 | parity | `en.md` or `it.md` missing; frontmatter invalid or wrong `lang`; entity H2s are not exactly the 13 canonical titles of `src/i18n/sections.ts`, in order, in the file's own language; pattern H2 counts differ; claim-marker (`<!--c:ID-->`) sets differ between languages | entities, patterns (incl. drafts) |
| 1w | translation freshness | `it.md` `translatedFrom` ≠ sha256 of the current `en.md` file. This is a **warning**, listed in `reports/translation-stale.json` (gitignored). | same |
| 2 | ledger | published entity/pattern without `docs/ledger/<id>.yaml`; a marker without a row, or a row without a marker; a `contradicted` row; `not-found-in-reference` / `beyond-reference` / `sources-differ` without a `secondSource` whose `source` is in `sources.yaml` (all entries there carry `existsVerified`); `sources-differ` without `<aside class="sources-differ">` in both languages; unknown `sourceRef.source`; a published question whose `claims[]` id is in no ledger; ledger `entity` ≠ file name | published |
| 3 | numbers | a sentence (or list item / table cell) with a digit followed by `%`, or a number (or range) followed by a time or measure unit (years/anni, months/mesi, weeks/settimane, days/giorni, hours/ore, mm, cm, µm, nm, kg, mg, µg, g, dL, mL, L, mmol, mEq, mmHg), does not end with a claim marker. Headings, code and ordinary HTML comments are ignored. This is a heuristic; extend the unit list in `markdown.ts` when new units appear. | entities, patterns |
| 4 | references | relation or prerequisite target is neither an entity (draft or published) nor a `planned` id in `modules.yaml`; self-relation; contradictory directed pair (A causes B and B causes A); prerequisite cycle; lens term not in `taxonomy/<lens>.yaml`; unknown source id; unknown image id (entity `images[].id`/`pairWith`, pattern `images`, question `image`); pattern matrix row or pattern image pointing to an unknown entity; question `entities`/`backLink.entity` unknown or `backLink.section` not a section anchor. Matrix `cells.length = columns − 1` is enforced by the schema. | non-fixture |
| 5 | review | `expert-reviewed` without `reviewedBy`, without a `REVIEWERS` file, or with a `reviewedBy.name` not listed in `REVIEWERS`; `reviewedBy` set when the item is not expert-reviewed | entities, patterns, questions |
| 6 | images | image file missing under `src/assets/images/`; `CC-BY-SA-*` without `ownerApproved: true` or `patientIdentifiable` not `false` (schema rules, reported under this gate) | all images |

Not covered here:

- `[[id]]` link resolution. A separate change owns it.
- Checking that the commit author is in `REVIEWERS` (CONTENT_SCHEMA §1a). Only `reviewedBy.name` is checked.
- Notes on symmetric relations declared on both sides must agree.
- DOI/PMID resolution (scheduled network job).
- REVIEW_QUEUE entries.

## Pre-commit

`simple-git-hooks` runs `node scripts/guard.mjs --staged` (containment) and then `node scripts/no-verbatim.mjs --staged`. The second command does nothing and exits 0 when `.work/` does not exist (CI, fresh clones, worktrees). Otherwise it checks staged files under `src/content/` and `docs/ledger/` against `.work/*.txt`. After changing the hook in `package.json`, run `npx simple-git-hooks` once to reinstall it.
