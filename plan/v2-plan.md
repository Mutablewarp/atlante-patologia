# v2 plan — reading, study layer, images, 3D, WHO watch, full programme

Inputs: owner requests of 2026-11-03 (two messages) and research notes in `private/research/` (gitignored, never published: programme sheets, exam format, image sources, WHO status, viewer/3D tech, critic report).

Public-naming rule: no teacher names, channel names, course codes or university name in any tracked file or public page. Programme-derived content uses neutral labels ("Possibile domanda", "Da attenzionare", "In sintesi").

## Owner decisions (2026-11-03)

| ID | Decision |
|---|---|
| O7 | CC BY-SA images approved as a class (2.0/3.0/4.0, incl. ported variants); NC, ND, "educational use only" stay forbidden |
| O8 | Exam questions from: the official programme and its teaching hours; public student collections (no login, short labels only); real questions the owner supplies in `private/domande/`. Inferred questions are labelled as possible questions |
| O9 | 3D = real PDB structures (rotatable) + animated 2D step schema; no whole-cell scenes |
| O10 | Build the v2 features on g01 first, then every part of the programme in programme order, each entity in full detail |
| O11 | Remove the per-page "AI-generated" badge; keep one AI-assistance line in the footer and on the Method page (EU AI Act art. 50(4), applies from 2026-08-02) unless the owner reviews content and takes editorial responsibility |
| O12 | Reading optimised for phone, tablet and desktop, iOS and Android: comfortable, low eye strain, engaging scroll |

## Agent decisions (within the brief)

- Programme first: the official programme decides what is built; teachers' research areas only decide where to go deeper inside it.
- Scientific-society archives are not reused (all rights reserved, or NC/ND); WHO/IARC text is never copied; the WHO watch only opens issues for human review.
- 3Dmol.js 2.5.5, lazy-loaded behind a button; OpenSeadragon 6.1.1 only for images longer than ~4,000 px; structures as committed CC0 BinaryCIF files; Zlib added to the licence allowlist (pako, permissive).
- Lazy vendor chunks are excluded from the service-worker precache.

## Phases

### V2.1 Reading and study layer (code, on g01) — workflow W1
- [x] Reading UX: fluid type scale, 60–72ch measure, line-height ~1.65, warm off-white and soft dark themes, `hyphens: auto`, `text-wrap: pretty/balance`, safe-area insets, `dvh`, 44 px targets, sticky section chips + scroll progress, callout styles for study blocks, sections open by default, reduced-motion aware
- [x] Remove the AI badge from entity and pattern pages; footer + Method line (O11)
- [ ] Study blocks on every card: Possibili domande (oral style), Da attenzionare (traps), In sintesi (high-yield), Come si studia (specimen, section, stain, IHC, molecular) — open: callout styles and the `examQuestions` block are merged; no Come si studia section and no renamed labels yet
- [x] Metacognition: confidence rating before reveal (quick check, quiz, review); calibration view in Me
- [ ] Oral exam simulator: three questions across the programme, self-assessment rubric — code merged 2026-11-04; no published exam questions yet (V2.2), so production shows the empty state
- [ ] Image viewer: pan buttons (WCAG 2.5.7), sharper zoom via srcset, stain/section switch (`group`), magnification presets, scale bar only with `mpp` — done except the magnification presets (merged 2026-11-04)
- [x] Service worker: exclude lazy vendor chunks, with a test
- [x] WHO watch: weekly GitHub Action + script + human-edited baseline + tests; `classification` block on entities with "newer edition exists" notice; refresh SOURCES §2 and VERIFIED_FACTS

### V2.2 g01 enrichment (content) — workflow W2
- [ ] Per entity: 3–6 possible oral questions with model answers, Come si studia, extra original diagrams where they add understanding
- [ ] Images: multi-magnification sets and special stains (Perls, PAS, von Kossa, Congo red, Oil Red O, Masson) and IHC where meaningful; licence and identifiability checks as before
- [ ] 3D: fetch structures + provenance; step lists for intrinsic/extrinsic apoptosis, necroptosis, pyroptosis, autophagy, ubiquitin–proteasome, p53; poster images

### V2.3 Methods module (g10)
Request form, biopsy types, frozen section, cytology (exfoliative, imprint, FNA), routine and special stains, IHC, molecular tests and predictive markers, autopsy.

### V2.4 General pathology completion
Inflammation and repair, haemodynamics and thrombo-embolism, neoplasia (nomenclature, grading, staging, metastasis, sentinel node, micrometastases, markers).

### V2.5 Module I organ blocks, programme order
Cardiovascular, respiratory, digestive (incl. liver and pancreas), urinary, male genital, female genital (incl. placenta).

### V2.6 Module II organ blocks, programme order
Endocrine, CNS, bone and soft tissue, immune, haematopoietic and lymphoid (largest block), breast, skin.

Each content phase: author → translate → independent verify against the reference → fix → images → questions → diagrams → finalize → integrate → CI → deploy → live smoke test.

## Done means
CI green on main (test, e2e Chromium/Firefox/WebKit, Lighthouse ≥ 90), deploy succeeded, live smoke test passed in Chromium and WebKit, no-verbatim 0 failures, no contradicted claims, PROGRESS.md updated.

## Risks
- Session limits interrupt long workflows: resume with cached agents; plans stay on disk.
- Repository and Pages size (1 GB site): images capped per file; whole-slide images only as cropped static tiles.
- Scheduled workflows stop after 60 days without repository activity.
- Only one reference text is available locally; claims beyond it need a second open source, as in g01.
- WHO 6th-edition volumes in beta can change; cards keep 5th-edition citations until print.
