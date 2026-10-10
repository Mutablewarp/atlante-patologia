# g01 content plan — Cell injury, adaptation and death (Phase 2 vertical slice)

Planning input for the content agents. Names are standard terminology; no reference text is reproduced here. "Ref pp." are **printed** page numbers in `rubin-8e` (printed = PDF − 24). Verifiers read the PDF pages (printed + 24) from the local extraction.

## Entities (26)

| # | id | IT name | EN name | kind | tier | Ref pp. (rubin-8e) | Key relations (type → target) |
|---|---|---|---|---|---|---|---|
| 1 | `hydropic-swelling` | Rigonfiamento idropico (degenerazione idropica) | Hydropic (cellular) swelling | process | core | 3–4 | differentialOf → fatty-change; causes ← hypoxic-ischemic-injury |
| 2 | `fatty-change` | Steatosi (degenerazione grassa) | Fatty change (steatosis) | process | core | 4–6; organ context 867–870, 880 | differentialOf → hydropic-swelling; sharesMechanism → intracellular-accumulations |
| 3 | `hypoxic-ischemic-injury` | Danno cellulare ipossico-ischemico | Hypoxic–ischemic cell injury | process | core | 4–5, 38–45 | causes → coagulative-necrosis, hydropic-swelling; prerequisiteOf → ischemia-reperfusion-injury |
| 4 | `ischemia-reperfusion-injury` | Danno da ischemia-riperfusione | Ischemia–reperfusion injury | process | core | 42–45 | sharesMechanism → oxidative-injury |
| 5 | `oxidative-injury` | Danno ossidativo (radicali liberi) | Oxidative (free-radical) injury | process | core | 30–37 | sharesMechanism → ischemia-reperfusion-injury |
| 6 | `intracellular-accumulations` | Accumuli intracellulari | Intracellular accumulations | process | core | 4–7 | prerequisiteOf → pigment-accumulation |
| 7 | `pigment-accumulation` | Accumulo di pigmenti (lipofuscina, emosiderina, melanina, bilirubina, esogeni) | Pigment accumulation | process | core | 5–7 | — |
| 8 | `dystrophic-calcification` | Calcificazione distrofica | Dystrophic calcification | process | core | 29–30 | differentialOf → metastatic-calcification |
| 9 | `metastatic-calcification` | Calcificazione metastatica | Metastatic calcification | process | core | 29–30 (+ organ context) | differentialOf → dystrophic-calcification |
| 10 | `atrophy` | Atrofia | Atrophy | process | core | 19–24 | differentialOf → hypertrophy (contrast) |
| 11 | `hypertrophy` | Ipertrofia | Hypertrophy | process | core | 19–24 | differentialOf → hyperplasia |
| 12 | `hyperplasia` | Iperplasia | Hyperplasia | process | core | 25–27 | differentialOf → hypertrophy |
| 13 | `metaplasia` | Metaplasia | Metaplasia | process | core | 27–29 | prerequisiteOf → dysplasia |
| 14 | `dysplasia` | Displasia | Dysplasia | process | core | 29 | prerequisiteOf ← metaplasia (cross-link to g05 planned) |
| 15 | `protein-quality-control` | Controllo di qualità delle proteine (sistema ubiquitina-proteasoma, chaperoni HSP) | Protein quality control (ubiquitin–proteasome system, heat shock proteins) | concept | extended | 7–13 | prerequisiteOf → autophagy |
| 16 | `autophagy` | Autofagia | Autophagy | process | core | 13–18 | sharesMechanism → apoptosis (crosstalk) |
| 17 | `coagulative-necrosis` | Necrosi coagulativa | Coagulative necrosis | process | core | 38–42 (+ infarct organs) | differentialOf → liquefactive-necrosis, caseous-necrosis; causes ← hypoxic-ischemic-injury |
| 18 | `liquefactive-necrosis` | Necrosi colliquativa | Liquefactive necrosis | process | core | 39–40 (+ CNS) | differentialOf → coagulative-necrosis |
| 19 | `caseous-necrosis` | Necrosi caseosa | Caseous necrosis | process | core | 40 (+ TB) | differentialOf → coagulative-necrosis |
| 20 | `fat-necrosis` | Necrosi adiposa (steatonecrosi) | Fat necrosis | process | core | 39–40 (+ pancreas, breast) | — |
| 21 | `fibrinoid-necrosis` | Necrosi fibrinoide | Fibrinoid necrosis | process | core | 40 (+ vasculitis, malignant hypertension) | — |
| 22 | `gangrene` | Gangrena | Gangrene | process | core | 38–40 (+ infection, vascular) | sharesMechanism → coagulative-necrosis |
| 23 | `apoptosis` | Apoptosi | Apoptosis | process | core | 41, 45–54 | differentialOf → coagulative-necrosis (apoptosis vs necrosis) |
| 24 | `necroptosis` | Necroptosi | Necroptosis | process | extended | 54–55 | sharesMechanism → apoptosis |
| 25 | `pyroptosis` | Piroptosi | Pyroptosis | process | extended | 56–57 | — |
| 26 | `other-regulated-cell-death` | Altre forme di morte cellulare regolata (anoikis, NETosi, entosi, morte da granzimi) | Other regulated cell death (anoikis, NETosis, entosis, granzyme-mediated) | concept | extended | 54–58 | — |

Not included: ferroptosis (not covered in `rubin-8e`; would need a verified second source — deferred).

## Pattern Page

- `p01` **Types of necrosis / Tipi di necrosi**: matrix rows = the 6 necrosis entities; columns = typical organs/settings, mechanism, gross appearance, microscopic appearance, typical outcome. Organ examples (verify on these pages): coagulative 38–40, 337, 365, 657, 955, 962; liquefactive 39–40, 1465, 1490; caseous 40, 431, 451, 735–738, 1468; fat necrosis 39–40, 837, 903–905, 1074–1077; fibrinoid 40, 147–158, 620–622, 951, 967; gangrene 330–338, 416–429.

## Questions

≥ 30 original clinical-vignette MCQs (4–5 options, one correct, every option explained), spread over all 26 entities, difficulty 1–3, plus ≥ 6 image-spot items if license-verified images exist. Every question links back to an entity section.

## Glossary (≥ 20 terms)

e.g. pyknosis, karyorrhexis, karyolysis, eosinophilia (cytoplasmic), myelin figures, councilman-like/apoptotic bodies, efferocytosis, caspase, cytochrome c, BCL-2 family, death receptor, ubiquitin, proteasome, chaperone, lipofuscin, hemosiderin, Prussian blue (Perls) stain, von Kossa stain, saponification, Barrett metaplasia, ROS.

## Learning paths

- Vertical: "Fundamentals: injury, adaptation, death" (g01 in teaching order).
- Horizontal: "Necrosis across organs" (p01 + the 6 necrosis entities).

## Images

- Original SVG diagrams (license = project content license): necrosis vs apoptosis comparison; intrinsic vs extrinsic apoptosis; adaptation spectrum (normal → atrophy/hypertrophy/hyperplasia/metaplasia → dysplasia); reversible vs irreversible injury timeline; calcification dystrophic vs metastatic.
- Photographs / micrographs: only with verified license (Wikimedia Commons file page / NCI Visuals PD / CDC PHIL PD), patient-non-identifiable, metadata per CONTENT_SCHEMA §5. Gaps → `docs/MISSING_ASSETS.md`.
