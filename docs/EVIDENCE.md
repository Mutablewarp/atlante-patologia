# Evidence behind the study tools

Status: 2026-10-10, study engine (feat/study-engine). User-facing version: `/[lang]/about/evidence/` (it + en).

Rules for this page and for any study-tool copy:
- Cite only sources whose existence was checked (DOIs in [VERIFIED_FACTS.md](VERIFIED_FACTS.md) §L, registry in `src/content/sources.yaml`).
- Phrase findings as "evidence suggests…", state limits, and never promise exam results or grades.
- Do not quote effect sizes we have not read in full; describe what each source examined.

## Feature → evidence map

| Feature | What we built | Sources | How we phrase it |
|---|---|---|---|
| Spaced review | FSRS (ts-fsrs 5.4.2, default parameters), daily queue, new-card limit | Dunlosky et al. 2013 (distributed practice rated high utility); Maye & Hurley 2026; Frappa et al. 2026 (systematic reviews, medical education) | Evidence suggests a link with better results; many studies are observational and self-selected |
| Quizzes / retrieval practice | Topic, mixed, timed exam, weak areas; feedback on every option + back-link | Larsen, Butler & Roediger 2008; Green, Moeller & Spak 2018 (BEME Guide 48); Dunlosky et al. 2013 (practice testing rated high utility) | Answering questions helps memory more than re-reading; feedback matters |
| Interleaving, image training | Mixed mode interleaves entities; spot-the-diagnosis, gross/micro pairs, look-alikes | Thompson & Hughes 2023 (radiology: spaced learning, interleaving, retrieval); Kuo & Leo 2019 (optical vs virtual microscope) | Studied with image-based material; described, not claimed as proof |
| Self-explanation | "Spiega perché / Explain why" prompts from `meta.selfExplain` | Dunlosky et al. 2013 (self-explanation rated moderate utility) | Moderately useful |
| Concept connections | Relations, concept map (horizontal-tools branch) | Aljamal et al. 2025 (mind/concept maps, preclinical medical students) | Examined in a systematic review |
| Highlights | Saved per section, listed under Me → Notes | Dunlosky et al. 2013 (highlighting rated low utility) | Honest note: for finding passages, not a learning technique |

## Limitations stated on the page

1. Populations, materials and outcomes differ from this atlas; results may not transfer.
2. Spaced-repetition studies in medical education are largely observational.
3. Profile numbers (coverage, mastery, review debt) are estimates from the learner's own use, not grade predictions.
   - Coverage: an entity counts as read when ≥ 80 % of its 14 sections (13 + Quick check) were scrolled to the end.
   - Mastery: a flashcard is mature when FSRS state is Review and stability ≥ 21 days.
4. FSRS runs with default parameters (no per-learner optimisation yet).

## Deliberately absent

- No streaks, badges, leaderboards or loss-framed reminders. The only reminder is a dismissible backup prompt 14 days after the last export (or first use), shown only on Study and Me pages.
- No prediction of exam scores.
