# Task Plan: Pathology atlas — PHASE 0 (Discovery)

## Goal
Produce the Phase 0 docs from the owner's spec and stop at CHECKPOINT 1 with only the owner's questions open.

## Phases
- [x] 0.1 Containment before anything else: .gitignore (reference/, .work/, *.pdf/epub/docx), reference/ = symlink (no copy)
- [x] 0.2 Reference intake: identify title/edition/year (copyright page), page count, outline, full-text extraction to .work/
- [x] 0.3 Structure analysis: chapter page ranges, heading tree, entity candidates per chapter (all pages, programmatic)
- [x] 0.4 Verify external facts (versions, GH Pages limits, Safari storage, WCAG, editions, DOIs) -> docs/VERIFIED_FACTS.md (sub-agent, parallel)
- [x] 0.5 Write docs: SOURCES, SYLLABUS_MAP, ARCHITECTURE, CONTENT_SCHEMA, NAVIGATION_SPEC, COMPLIANCE_PLAN, RISKS, DECISIONS, PROGRESS
- [x] 0.6 Self-check: no reference sentences in docs (headings rewritten in own words), links/paths consistent
- [x] 0.7 CHECKPOINT 1 report + owner questions

## Key Questions (owner, at CHECKPOINT 1)
1. Product name  2. Code + content licenses  3. Domain  4. Syllabus scope/depth  5. Default language  6. Editions supplied / Italian terminology source

## Decisions Made
- Project lives in session scratch workspace for Phase 0; offer to move to a permanent folder at CHECKPOINT 1 (name TBD).
- Reference is symlinked, never copied; extraction output stays in gitignored .work/.

## Errors Encountered
- First ad-hoc control run read the exit code of `cut`, not the checker -> re-ran with output to file; exit=1 as expected.
- PyMuPDF not installed system-wide -> use `uv run --with pymupdf python -I`.

## Status
**PHASE 0 complete (2026-10-10)** — stopped at CHECKPOINT 1, waiting for owner answers O1–O6 (docs/DECISIONS.md).
