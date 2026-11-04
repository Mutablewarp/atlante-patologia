# Compliance plan

Status: PHASE 0 plan, 2026-10-10; the State column and the facts below were brought in line with the code on 2026-11-04.

**This is not legal advice, and the project is not declared "compliant".** This plan defines what evidence will be produced and which questions stay open for the owner. The evidence is collected in `docs/COMPLIANCE_REPORT.md` (Phase 5).

## 1. Reference containment and copyright hygiene

| Item | Mechanism | Phase | State |
|---|---|---|---|
| 1.1 `/reference/` and `/.work/` never committed | `.gitignore` entries | 0 | **Done**: `.gitignore` written before any git init |
| | Pre-commit hook (`simple-git-hooks` → `node scripts/guard.mjs --staged`): blocks staged paths under `reference/`, `.work/` or `private/`; any `.pdf/.epub/.docx/.mobi/.azw3` > 100 KB; any file > 10 MB | 1 | **Done** |
| | CI job runs the same guard over `git ls-files` (`npm run guard`, protects against `--no-verify`) | 1 | **Done** |
| | Reference added as a **symlink**, not a copy | 0 | **Done** |
| 1.2 Allowed use | Structure, terminology and fact checking only. No copied or closely paraphrased sentences, tables, figures, boxes or captions. All text, mnemonics, questions and diagrams are original | all | rule |
| 1.3 No-verbatim guard | See §1a (`scripts/no-verbatim.mjs`) | 1 | **Done** (local and pre-commit only; thresholds not yet calibrated, D019) |
| 1.4 Edition awareness | [SOURCES.md](SOURCES.md) | 0 | **Done** for the one supplied reference |
| 1.5 Claim ledger | [CONTENT_SCHEMA.md](CONTENT_SCHEMA.md) §8; separate fresh-context verifier sub-agent. Claims checked only by the agent that wrote or corrected them are counted and listed on the Method page (D061) | 2 | **Done** for g01, p01 and the intrinsic apoptosis pathway |
| 1.6 Numbers and citations | Numeric sentences must carry a ledgered claim marker (numbers gate). DOIs/PMIDs are checked against Crossref/PubMed and the results committed (`existsVerified` in `src/content/sources.yaml`) | 1–2 | **Done** |
| 1.7 Review status | `ai-generated-unreviewed` by default; only a listed human reviewer can set `expert-reviewed`, which shows an "Expert-reviewed" badge with the reviewer's name. No per-page AI badge (owner decision O11, D052): one AI line in the footer of every page and the Method page carry the disclosure | 1–2 | **Done** |

### 1a. No-verbatim guard — method and threshold

- **Input:** every user-visible string in `src/content/**` (markdown bodies, YAML strings, captions, alt text, questions, glossary, mnemonics) and the claim ledger statements in `docs/ledger/`.
- **Reference side:** text extracted locally from every file in `/reference/`, including figure captions and tables.
- **Normalization:**
  - lower-case and Unicode NFKC;
  - de-hyphenate line breaks;
  - strip punctuation and markdown/HTML;
  - collapse whitespace;
  - drop our claim markers.
- **Fail conditions:**
  1. any run of **≥ 12 identical consecutive words** shared with a reference; or
  2. a content file's share of 8-word n-grams also present in the reference exceeds **1%**.
- **Why 12 and 1%:**
  - Standard technical phrases ("diffuse large B-cell lymphoma", "systemic lupus erythematosus") are 2–5 words. Independent writing on the same topic rarely shares 12-word runs, so a 12-word match is strong evidence of copying.
  - 8-grams catch close paraphrase that alters a few words. A 1% ceiling allows a handful of unavoidable fixed phrases per card.
  - Phase 1 was to calibrate the threshold (not recorded yet; D019 stays "pending calibration"):
    - run the guard on original text written without the reference (expected ≈ 0%);
    - run it on deliberately close paraphrases (expected well above 1%);
    - record both results in DECISIONS.
- **When it runs:** pre-commit on staged content, and in full at the end of every phase. Without local reference text (CI, fresh clones, worktrees) it prints "SKIPPED" and exits 0; `NO_VERBATIM_WORK` points it at a reference folder elsewhere. CI does not run it.
- **Reference text quality:** about 1,000 lines of the extracted reference were stored with shifted character codes and could not match anything until they were decoded on 2026-11-04. The decoded text exposed one ledger statement with two shared 12-word runs (`p01-necrosis-c021`), which was reworded.
- **Known blind spot:** n-grams cannot detect **translation** of the English reference into Italian. Mitigations:
  - (a) English is the authoring language and is guarded; Italian is translated from **our** English, never from the reference (D024);
  - (b) the verifier agent and human reviewers spot-check Italian against the reference;
  - (c) if Italian references are supplied, they are guarded too.

## 2. Evidence for the compliance report

| # | Item | What will exist | Phase |
|---|---|---|---|
| 1 | **Dependency license ledger** | `license-checker-rseidelsohn` JSON in `docs/licenses/dependencies.json` (name, version, license, repo URL); a date-stamped run; allowlist (MIT, ISC, BSD-2/3-Clause, Apache-2.0, 0BSD, CC0-1.0, BlueOak-1.0.0, OFL-1.1 for the fonts, Zlib for `pako` inside 3Dmol, D050); CI fails on others. Build- and dev-only exceptions are listed with a reason in `scripts/license-scan.mjs`, e.g. `@axe-core/playwright` MPL-2.0, not distributed. Compatibility note: everything shipped to the browser (Preact MIT, ts-fsrs MIT, idb ISC, Pagefind MIT; 3Dmol.js BSD-3-Clause, loaded on demand, with its bundled `pako` (MIT AND Zlib) and `mmtf-javascript` (MIT), whose notices are on the Licences page) is permissive and compatible with either proposed code license | 1, re-run 5 |
| 2 | **Image ledger** | One YAML per image (CONTENT_SCHEMA §5); CI blocks incomplete metadata; generated Credits page; `docs/MISSING_ASSETS.md` | 2+ |
| 3 | **License proposals** | §3 below — owner decides | 0 (now) |
| 4 | **Trademark / naming check** | After the owner picks a name: searches in EUIPO eSearch/TMview, UIBM (Italy), USPTO, WIPO Global Brand Database; GitHub, npm and domain collisions; written up with dates and screenshots. No publisher or product marks in name, domain or logo | 1 |
| 5 | **Privacy statement + proof** | Statement: no accounts, no analytics, no cookies, no third-party requests, self-hosted OFL fonts bundled with the site (D015), no CDNs, no embeds, all study data stays on the device. **Disclosure required:** GitHub Pages logs visitor IP addresses for security (verified, VERIFIED_FACTS §C). Proof: a Playwright test records every request on representative pages in all 3 engines and asserts that all share the site origin and no cookies are set | 1 |
| 6 | **Medical disclaimer** | Footer on every page plus a first-launch notice (dismissal stored locally). Text (EN/IT): educational use only, not for diagnosis or treatment decisions, may contain errors, report errors here. **Flag:** whether this software is a medical device under the EU MDR or Italian rules was **not verified** | 1 |
| 7 | **AI-assistance disclosure** | One line in the footer of every page, including the language entry `/`, linking to the About/Method page: what was AI-generated, the claim ledger and verifier process, the claims checked only by the agent that wrote or corrected them, review status meaning, known limitations, how to report errors. Basis: owner decision O11 (D052), EU AI Act art. 50(4), applicable from 2026-08-02; not legal advice | 1–2 |
| 8 | **Accessibility statement** | Target WCAG 2.2 AA; test methods (axe, keyboard, Playwright viewports, manual SR checklist); known limitations; contact route | 1, final 5 |
| 9 | **Contact / error report / takedown** | GitHub issue templates: content error, image/copyright takedown, accessibility, translation. Proposed commitment for the owner to confirm: acknowledge within 7 days; on a credible takedown request, remove the disputed asset within 72 h pending review. Note: GitHub issues need a GitHub account, so the owner decides whether to also publish an e-mail address | 1 |

## 3. License proposals (owner decides)

| Option | Applies to | Pros | Cons / obligations |
|---|---|---|---|
| **MIT** | code | Shortest, most familiar, maximal reuse | No explicit patent grant |
| Apache-2.0 | code | Explicit patent grant; NOTICE handling | Longer; redistributors must keep NOTICE and state changes |
| **CC BY 4.0** | original content (text, questions, diagrams) | Maximum reuse, including in other courses and slide decks, mixed with any material | Anyone may build closed or paid derivatives, with attribution only |
| **CC BY-SA 4.0** | original content | Adaptations must stay open under BY-SA; matches the "free for everyone" goal; same family as many Wikimedia images | ShareAlike binds adapters: teachers mixing our text into differently-licensed material may not be able to; derivative text must carry BY-SA |

My recommendation: **MIT for code + CC BY-SA 4.0 for content.** It keeps every derivative open. If maximum reuse matters more than keeping derivatives open, choose CC BY 4.0.

**Decided (O2, 2026-10-10):** MIT for code and CC BY-SA 4.0 for content.

Notes for either choice:
- Third-party images keep their own licenses, with per-image credit lines.
- Any image *we modify* (crop, annotate) that was CC BY-SA must be released as CC BY-SA.
- Non-commercial (NC) variants are not recommended: they are not open licenses under common OER definitions, and they complicate reuse by schools.

## 4. Image policy (from the brief, operationalized)

- **Allowed:**
  - original SVG/diagrams (license = project content license);
  - public domain;
  - CC0;
  - CC BY;
  - CC BY-SA 2.0, 2.5, 3.0 and 4.0, ported variants included: approved as a class by the owner on 2026-11-03 (O7, D051). Each such image carries `ownerApproved: true`, which the schema requires.
- **Still forbidden licences:** NC, ND and "educational use only".
- **Per-source checks:**
  - **Wikimedia Commons:** read the license on the *file page*. Confirm the creator, not just the uploader; reject when "own work" is doubtful, for example scanned book figures. Reject images with identifiable people.
  - **NIH/NCI Visuals Online, CDC PHIL:** use only items labeled Public Domain.
  - **NLM Open-i:** per-image license; no license shown means do not use.
  - **PubMed Central:** only figures in articles with an explicit CC BY or CC0 license. "Open access" alone is not enough.
- **Forbidden:**
  - textbook figures;
  - commercial atlases;
  - "free for educational viewing" sites without a redistribution license;
  - question-bank screenshots;
  - patient-identifiable images;
  - anything unverifiable.
- **Failure path:** use a placeholder plus a `docs/MISSING_ASSETS.md` entry. Never assume an image is fine.

## 5. Open questions for the owner

1. **Reference access:** confirm lawful access to every supplied reference. Their only use is local, non-distributed fact-checking.
2. ~~**Licenses:** code (MIT / Apache-2.0) and content (CC BY 4.0 / CC BY-SA 4.0).~~ Answered: MIT + CC BY-SA 4.0 (O2).
3. **Takedown / response commitment** (§2 item 9) and whether to publish a contact e-mail.
4. **Medical-device classification** (EU MDR / Italy) of educational software: not verified; consider asking your university's legal office.
5. **Storage without consent:** the project stores progress in IndexedDB/localStorage only for features the user explicitly uses, and sets no cookies. Whether this falls under the "strictly necessary" exemption of the ePrivacy rules as applied in Italy was **not verified**.
6. **European Accessibility Act:** applicability to a free, non-commercial educational site was not verified. WCAG 2.2 AA is targeted regardless.
