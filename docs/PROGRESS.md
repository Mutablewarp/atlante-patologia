# Progress

## PHASE 0 — Discovery (2026-10-10) — complete, waiting at CHECKPOINT 1

| Step | Evidence (commands actually run) | Result |
|---|---|---|
| Containment before anything else | `.gitignore` written first; `reference/rubin.pdf` is a symlink (`ls -la reference`) | `/reference/`, `/.work/`, `*.pdf/*.epub/*.docx` ignored; no git repo yet, so no commit was possible |
| Reference intake | PyMuPDF via `uv run --with pymupdf python -I` on all pages | 1,671 PDF pages; 8th ed., © 2020 Wolters Kluwer; 651-entry outline; 34 chapters |
| Full-text extraction | Same script, all pages → `.work/fulltext.txt`, `.work/lines.jsonl` | 977,036 words; 154,420 styled lines (gitignored) |
| Structure analysis | Font-style profiling → heading tree `.work/headings.tsv` | 4,080 headings; 817 labelled disease-entity sections; printed page = PDF − 24 (1,198/1,198 pages agree) |
| External facts | Sub-agent: `npm view`, GitHub releases API, Crossref API, official docs; follow-up `npm view` checks | [VERIFIED_FACTS.md](VERIFIED_FACTS.md) sections A–M; 8/8 DOIs match; 4 toolchain conflicts found |
| Docs written | — | SYLLABUS_MAP, SOURCES, ARCHITECTURE, CONTENT_SCHEMA, NAVIGATION_SPEC, COMPLIANCE_PLAN, RISKS, DECISIONS, VERIFIED_FACTS, PROGRESS |
| No-verbatim self-check of all docs | Ad-hoc n-gram script (12-gram any-hit, 8-gram > 1%) against the full reference text | 12/12 files: 0.00% 8-gram overlap, 0 shared 12-grams. Positive control (30-word reference excerpt): FAIL as expected (exit 1) |

Not done in Phase 0 (by design):
- No code, no git init, no commits, no deployment.
- Italian terminology is proposed, not verified: no Italian reference was supplied.

## PHASE 1 — Foundation
Not started. Blocked on CHECKPOINT 1 answers (name, licenses, domain, scope, default language, references) and on the owner running `gh auth login`.
