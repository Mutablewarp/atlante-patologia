# WHO watch: runbook

A weekly GitHub Action ([`.github/workflows/who-watch.yml`](../.github/workflows/who-watch.yml)) runs [`scripts/who-watch.mjs`](../scripts/who-watch.mjs). It reads public metadata about WHO and IARC publications, compares it with the reviewed state in [`data/who-watch/baseline.json`](../data/who-watch/baseline.json) and opens one GitHub issue per change, labelled `who-watch` and `needs-human-review`.

The bot **never commits and never edits content**. Every content change goes through a normal pull request with the claim ledger and the verifier ([CONTENT_SCHEMA.md](CONTENT_SCHEMA.md) §8).

## 1. What it checks

| Source id | What | A change means |
|---|---|---|
| `catalogue` | IARC catalogue of the WHO Classification of Tumours | A new volume is listed, or an old one gets "new edition available" |
| `corrigenda/<slug>` | Corrigenda tab of each 5th- and 6th-edition volume page | A corrigenda file was added or replaced |
| `online` | Volume list of WHO Classification of Tumours Online | A new online volume, or a beta volume moved to print |
| `news` | IARC tumour-classification news feed (classification items only) | A volume, ICD-O or cytopathology announcement |
| `monographs` | IARC Monographs "agents classified" page | Its "Last update" date changed (modules g05, g08) |
| `icd11` | ICD-11 MMS latest-release redirect | A new yearly ICD-11 release |
| `iris` | Newest "WHO guideline" records in WHO IRIS | A new guideline record |
| `pubmed` | PubMed search for journal summaries of WHO 6th-edition volumes | A new summary article (check its licence before reuse) |

Rules the script follows: public pages only, no login, no PDF or subscription downloads, one request at a time, a 20 s timeout and one retry, no retry after HTTP 403 or 429. Issues hold metadata only (title, edition, volume, year, URL); never paste WHO/IARC text into an issue.

Each issue ends with a line `who-watch:<fingerprint>` (12 hex characters of a SHA-256 of the change). The script skips a change when any open **or closed** `who-watch` issue already has that fingerprint, so closing an issue never makes it come back.

## 2. Triage an issue

1. Open the item URL. Confirm edition, volume, year and status (print, online beta, forthcoming).
2. Decide the impact: none, terminology only, content update, or mark the affected cards edition-dependent (`editionDependent` + `editionNote`).
3. Record the source in `src/content/sources.yaml`: `kind: standard`, `series`, `edition`, `volume` (only if published), `status`, `supersedes`, `isbn` (from the publisher page), `url`, and `existsVerified: { via: publisher, date: <today> }`. Update [SOURCES.md](SOURCES.md) §2 and [VERIFIED_FACTS.md](VERIFIED_FACTS.md) §K.
4. Find the cards to review: entities whose `classification.source` is the superseded volume (`git grep -n "source: who-5e-<x>" src/content/entities`), plus the modules the issue lists. Once `supersedes` is in `sources.yaml`, those cards show "newer edition available" at the next build.
5. Re-check each card in a normal PR. Write in our own words; cite only series, edition, volume, title and year; never copy definitions, criteria lists, tables, figures or images, in English or in Italian. Set `classification.checked` to the date you re-checked the card. Beta volumes: keep the 5th-edition citation until print, unless the owner decides otherwise.
6. Refresh the baseline (§3) and close the issue.

A **"source broken"** issue means the script could not read a source (moved page, new layout, rate limit). Fix the URL or the parser and its fixture under `tests/fixtures/who-watch/`, or drop the source. Never work around bot protection. There is at most one open such issue per source (a new one opens only after the previous one is closed). When more than three sources fail in one run, or more than 3 items (or 20 %) of a source's baseline vanish at once, the script opens a single summary or source-broken issue instead of one issue per source or item. Likewise, more than 10 changes in one run (typically every value of a source in a new format, or a baseline left stale for months) open one summary issue that lists them; the same burst is reported only once. Reading stops after 5 minutes; sources not read by then are reported broken. Fetched text is neutralised in issue bodies (no @-mentions, #-references, HTML or backticks), the fingerprint marker counts only on the last line, and GitHub POSTs are at least 1 s apart and honour `retry-after`.

## 3. Update the baseline

The baseline is the reviewed state; editing it is how a change is acknowledged.

```sh
node scripts/who-watch.mjs --dry-run   # what would be reported now (no GitHub calls)
node scripts/who-watch.mjs --init      # rewrite data/who-watch/baseline.json from the live sources
git diff data/who-watch/baseline.json  # every changed line must match an issue you have triaged
```

`--init` refuses to write while any source is broken. Commit the baseline in its own commit (`chore(who-watch): refresh baseline after <issues>`). After a refresh, `--dry-run` must print `no changes against the baseline`.

New 5th- or 6th-edition volumes get their own `corrigenda/<slug>` entry only after a refresh; until then the run log prints "not in the baseline yet".

## 4. Re-enable the schedule

GitHub disables scheduled workflows in a public repository after **60 days without repository activity**. When that happens, runs simply stop. To re-enable:

```sh
gh workflow enable who-watch.yml
gh workflow run who-watch.yml          # optional: run once now
gh run list --workflow who-watch.yml   # check the last runs
```

The Actions tab → "WHO watch" → "Enable workflow" does the same. Do not add a keep-alive bot commit. A monthly calendar reminder to check `gh run list` is enough.

## 5. Limits

- Silent edits inside WHO Classification of Tumours Online are invisible: the content needs a subscription, and IARC may update it without notice. Once a year, spot-check the cards with library or subscription access.
- Feeds are rolling windows (about 10 to 20 items). A missed month can lose general news, not volume releases (the catalogue and the online list are complete lists).
- The module hints in each issue come from titles only; check the volume's table of contents.
