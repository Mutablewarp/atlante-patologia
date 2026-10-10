# Risk register

Updated 2026-10-10. L = likelihood, I = impact (H/M/L). Highest priority first.

| ID | Risk | L | I | Mitigation | Owner |
|---|---|---|---|---|---|
| R1 | **Human review capacity.** ~590 core cards; at an assumed 20–40 min of expert review each, that is ~200–400 h. Without reviewers, everything stays `ai-generated-unreviewed` | H | H | Publish by tier and by module. The claim ledger and verifier agent cut reviewer effort (the reviewer checks flagged claims, not everything). Reviews happen through GitHub PR review. Badges are honest. Recruit reviewers (faculty, residents, senior students) | Owner |
| R2 | **Factual errors** in AI-written medical content mislead students | M | H | Per-claim ledger with fresh-context verifier; `contradicted` blocks release; "sources differ" shown openly; error-report link on every card; disclaimer | Agent + reviewers |
| R3 | **Reference age.** Text finalized in 2019; classifications changed (WHO 5th/6th ed., TNM 9, CNS5, haem, MASLD…) | H | M | `editionDependent` flag + `<aside class="edition">`; verify against current standards (SOURCES §2); recommend a second, current reference | Agent; owner supplies sources |
| R4 | **Image licensing.** Too few verifiable pathology images; uploader ≠ creator on Commons; takedowns | H | M | Strict per-file ledger; original SVG diagrams first; placeholders + MISSING_ASSETS; owner approval for BY-SA; takedown process | Agent + owner |
| R5 | **Size budget.** 2,400–4,800 images could exceed 300 MB (our budget) and approach 1 GB (Pages limit) | M | H | AVIF/WebP at 2 widths; CI budget per module; measure in Phase 2 and choose formats by data; cap images per card | Agent |
| R6 | **Copyright leakage.** Close paraphrase, or Italian text translated from the reference, which the n-gram guard cannot see | M | H | 12-gram / 1% 8-gram guard; English-first authoring (D024); verifier and reviewer spot checks; original mnemonics, questions and diagrams only | Agent + reviewers |
| R7 | **Reference access.** Lawful access to each supplied reference must be confirmed | M | M | Owner confirms access; reference files never leave the machine (symlink, gitignore, guards) | Owner |
| R8 | **Scope explosion.** ~1,190 entities, ≥ 3,600 MCQs, ~10k+ flashcards | H | M | Core tier first; owner sets depth; publish only fully gated modules; public Roadmap page | Owner + agent |
| R9 | **Safari storage eviction** (7-day rule outside Home Screen; `persist()` heuristic) loses progress | M | M | Home Screen guidance; `persist()` after first use; export/import with gentle reminder; plain-language explanation; WebKit Playwright tests; real-iPhone test by owner | Agent; owner tests device |
| R10 | **Toolchain drift.** `@vite-pwa/astro` lacks Astro 6/7 support; Preact 11 and TS 7 outside peer ranges; `@lhci/cli` stale; Node 24 → Maintenance 2026-10-20 | H | L | Pinned versions; hand-written service worker; lighthouse CLI direct; re-check VERIFIED_FACTS each phase | Agent |
| R11 | **Hosting limits.** Pages soft 100 GB/month bandwidth and HTTP 429 under load; no commercial use; public repo required | L | M | SW cache-first; opt-in packs; image budget; documented mirror plan (not enabled); stay non-commercial and ad-free | Owner |
| R12 | **Italian terminology** without an Italian reference | H | M | Owner names an Italian source; glossary review by an Italian-speaking reviewer; proposed terms marked as such | Owner |
| R13 | **Accessibility of complex widgets** (concept map, image viewer, timed quiz) | M | M | Accessible list/tree alternative; keyboard and SR design first; axe + manual checklist; timed mode has pause/extend | Agent |
| R14 | **Regulatory status** (medical device, ePrivacy, accessibility law) unverified | L | H | Disclaimers; questions listed for owner/legal office (COMPLIANCE_PLAN §5) | Owner |
| R15 | **Hallucinated citations/DOIs** | M | H | Crossref/PubMed check in CI (cached); `existsVerified` required in `sources.yaml`; no citation without it | Agent |
| R16 | **Translation drift** after edits to one language | M | M | Parity gate (structure + claim markers); `translatedFrom` hash warns when English changed after translation | Agent |
| R17 | **Prompt injection** from fetched web pages (image pages, articles) during agent work | M | M | Treat fetched text as data; licenses re-checked on the file page; human review of image ledger | Agent |
| R18 | **Single maintainer** (bus factor) | M | M | Complete docs, CONTRIBUTING, open license, "deploy your own copy" guide | Owner |
| R19 | **Session workspace is temporary.** Phase 0 files live in a scratch folder deleted with the session | H | M | Move the project to a permanent folder at CHECKPOINT 1 (needs the owner's chosen name and location) | Owner + agent |
