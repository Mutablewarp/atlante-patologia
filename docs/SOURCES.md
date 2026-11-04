# Sources

Updated 2026-11-03 (§2); otherwise 2026-10-10. Reference files live only in the gitignored `/reference/` folder and are never committed (see [COMPLIANCE_PLAN.md](COMPLIANCE_PLAN.md) §1).

## 1. Owner-supplied references

| ID | Title | Edition | Year | Publisher | Identifiers | Local file |
|---|---|---|---|---|---|---|
| `rubin-8e` | *Rubin's Pathology: Mechanisms of Human Disease* (eds. D. S. Strayer, J. E. Saffitz; founder and consulting editor E. Rubin) | 8th | © 2020 (publisher listing 2019) | Wolters Kluwer | LCCN 2019908240; ISBN 9781496386144 (print), 9781975141042 (eBook) — ISBNs from publisher listing, see [VERIFIED_FACTS.md](VERIFIED_FACTS.md) §K | `reference/rubin.pdf` (local symlink, gitignored; 1,671 PDF pages) |

How the edition was identified: copyright page (PDF p. 6) states "8th edition" and "Copyright © 2020 Wolters Kluwer". Editor roles were read from the title pages (PDF pp. 3–5).

### Edition status

- **Book edition:** the 8th edition is the latest *Rubin's* edition found on 2026-10-10. No 9th edition was found; that is absence of evidence, not proof ([VERIFIED_FACTS.md](VERIFIED_FACTS.md) §K).
- **Content age:** the text was finalized in 2019. Many classification systems have changed since, so the book is **older than the current standards** for every edition-dependent topic (next section).
- **Not supplied:** *Robbins, Cotran & Kumar Pathologic Basis of Disease*, 11th edition (May 2025), is the current edition of that book (verified). It was **not** supplied and is **not** used. Owner question: supply it, or an Italian textbook, as a second reference.

### Page-number convention for the claim ledger

- Ledger `sourceRef.pages` uses **printed book page numbers**, so the owner can check them in a physical copy.
- For `rubin-8e`, printed page = PDF page − 24. This is constant across all 34 chapters: 1,198 numbered pages checked by script, all agree.
- Chapter start pages (PDF) are in [SYLLABUS_MAP.md](SYLLABUS_MAP.md).

### Access

The owner confirms lawful access to every supplied reference. References are only read locally (structure, terminology, fact-checking) and are never redistributed.

## 2. Primary standards for edition-dependent content

These are used to verify, or to flag as "edition-dependent", the items the reference may have outdated. WHO status was re-checked 2026-11-03 ([VERIFIED_FACTS.md](VERIFIED_FACTS.md) §K); the other rows were checked 2026-10-10. Every WHO volume is an entry of `src/content/sources.yaml` (`series`, `edition`, `volume`, `status`, `supersedes`, `isbn`), and the weekly WHO watch reports changes for human review ([WHO_WATCH.md](WHO_WATCH.md)).

| ID | Standard | Current status (verified) | Use |
|---|---|---|---|
| `who-5e-*` | WHO Classification of Tumours, 5th ed., 14 volumes (print years 2019–2026; the series page gives the programme as 2018–2026) | Complete. Vol. 1 Digestive (`who-5e-dig`) is superseded by the 6th edition | Tumour names, definitions, grading per site |
| `who-6e-dig` | WHO Classification of Tumours, 6th ed., Vol. 1 Digestive System Tumours, ISBN 978-92-832-4548-3 | In print since 29 Jul 2026 (online before print) | Digestive tumours (o19, o20, o21) |
| `who-6e-breast`, `who-6e-fgt`, `who-6e-stb` | WHO Classification of Tumours, 6th ed.: Breast; Female Genital; Soft Tissue and Bone | Online beta, not yet in print; volume numbers not published | Cards keep the 5th-ed. citation until print (plan: beta policy) |
| — | WHO Classification of Tumours, 6th ed.: Thoracic; Central Nervous System | Listed as forthcoming; no date. Not in `sources.yaml` until a year is verified | o18, o32 later |
| — | ICD-O-4 (International Classification of Diseases for Oncology, 4th ed.) | Final tables published 20 Jul 2026 on WHO Classification of Tumours Online | Tumour codes (not yet used) |
| — | ICD-11 MMS | Current release `2026-01`; a new release every year | Disease codes (not yet used; CC BY-ND 3.0 IGO) |
| `uicc-tnm9` | UICC TNM Classification, 9th ed. | Published 2025; effective date not stated | Staging |
| `ajcc` | AJCC Cancer Staging (8th ed. + Version 9 site protocols) | 8th ed. applies per site until replaced by V9 | Staging where AJCC is the cited system |

Access caveat: WHO Blue Books and TNM are paid publications, and IARC content is all rights reserved. We use them to **check** terms and categories and cite only bibliographic facts (series, edition, volume, title, year, ISBN); we never copy their text, tables, figures or images, in English or in translation. If a needed standard is not accessible, the card carries "edition-dependent — not yet verified against current standard".

Entity cards that follow a WHO volume carry a `classification` block (`source`, optional `volume`, `checked` = the date a person last confirmed the card). The page shows the citation line and, at build time, a "newer edition available" notice when a print or online-beta volume in `sources.yaml` supersedes the cited one.

## 3. Edition-sensitive topics to verify in each batch

These came from reading the reference's structure, not from verified facts. Each becomes a ledger item in the batch that covers it.

| Topic | Why it is sensitive | Modules |
|---|---|---|
| CNS tumour classification and grading | Reference uses older WHO grading style; CNS classification was revised after 2019 | o32 |
| Haematolymphoid neoplasms | Two current classification systems exist (WHO-HAEM5 and ICC); expect "sources differ" | o26 |
| Fatty liver disease nomenclature | Reference uses pre-2023 terminology | o20 |
| COVID-19 and SARS-CoV-2 pathology | Not in the reference (finalized 2019) | g09, o18 |
| Mpox nomenclature | Reference uses the older disease name | g09 |
| Vasculitis names (e.g. EGPA) | Eponyms replaced in consensus nomenclature | o16, o18 |
| Serrated colorectal lesions, GI neuroendocrine tumours | WHO 5th/6th-ed. digestive changes | o19, o21 |
| Pituitary neuroendocrine tumours | Renamed in WHO endocrine classification | o27 |
| Thyroid, lung, breast, female genital, urinary/male genital, skin, soft tissue/bone, head & neck, eye tumours | Each has a WHO 5th-ed. volume newer than the reference | o18, o23–o25, o27–o30, o33 |
| Staging tables | UICC TNM 9 / AJCC V9 | all tumour cards |
| Sepsis definitions; diabetes classification | Consensus definitions revised over time | s12, s13 |

## 4. Evidence base for the study engine

All 8 DOIs from the brief resolve on Crossref and match title, first author, journal and year ([VERIFIED_FACTS.md](VERIFIED_FACTS.md) §L). Two print-year notes:

- Aljamal et al.: online 2025, print issue 2026; 31(2).
- Kuo & Leo: online 2018, print issue 2019; 12(6).

These will be cited in `docs/EVIDENCE.md` (Phase 1/2), with each claim phrased as "evidence suggests" and its limitation stated.

## 5. Images

None selected yet. Every image source is recorded per file in the image ledger (schema in [CONTENT_SCHEMA.md](CONTENT_SCHEMA.md) §5), not here.
