# Notes: Phase 0 discovery

No reference text is stored here — only counts, page numbers and method.

## Reference intake (2026-10-10)
- File: reference/rubin.pdf (local symlink, gitignored; 238,938,595 bytes; 1,671 PDF pages; PDF 1.6, created 2019-10-19).
- Copyright page (PDF p.6): 8th edition, © 2020 Wolters Kluwer, LCCN 2019908240.
- Embedded outline: 651 entries (1 book, 13 front-matter/section, 34 chapters, 204 L4, 399 L5).
- Sections: I Mechanisms of Disease (PDF p.25), II Pathogenesis of Systemic Conditions (p.519), III Diseases of Individual Organ Systems (p.613), Index (p.1589).
- Access note for the owner kept in gitignored private/OWNER_NOTES.md.

## Extraction method (all 1,671 pages)
- PyMuPDF via `uv run --with pymupdf python -I` (no system PDF tools installed).
- Output (gitignored): .work/fulltext.txt (6.9 MB), .work/lines.jsonl (154,420 lines with font/size/colour), .work/toc.tsv, .work/headings.tsv.
- Heading styles found by font profiling: H1 MyriadPro-BlackSemiCn 13pt; H2 MyriadPro-BoldSemiCn 12pt; H3 MyriadPro-BoldSemiCn 10.5pt; run-in labels MyriadPro-Bold 10.5pt (PATHOLOGY 640, CLINICAL FEATURES 485, MOLECULAR PATHOGENESIS 221, PATHOPHYSIOLOGY 189, EPIDEMIOLOGY 174, ETIOLOGIC FACTORS 121).
- 4,080 headings in chapters 1–34 (book page numbers share the H2 font and were filtered out). 817 headings carry a PATHOLOGY or CLINICAL FEATURES label = proxy for "disease entity section".
- Headings are mostly declarative sentences (creative expression) -> SYLLABUS_MAP uses standard disease/process names only, never the reference headings.

## Labelled entity sections per chapter (proxy, not final count)
1:3 2:0 3:1 4:0 5:0 6:19 7:14 8:12 9:110 10:0 11:4 12:1 13:3 14:28 15:1 16:26 17:42 18:61 19:46 20:41 21:6 22:55 23:22 24:45 25:12 26:53 27:22 28:36 29:20 30:46 31:19 32:55 33:14 34:0
General chapters (1–5, 10) organise by process, so the label proxy undercounts them; estimates there are judgement-based.

## Edition observations made while reading the structure (to verify, not facts)
- CNS tumours graded with Roman numerals (WHO 2016 style) -> WHO CNS5 (2021) changed grading/nomenclature.
- Infectious chapter predates COVID-19 (copyright 2020, LCCN 2019).
- Uses "nonalcoholic fatty liver disease", "Churg–Strauss", "monkeypox", "sessile serrated adenoma", "pituitary adenoma" — all renamed by later consensus/WHO publications (verify each).
- Female genital/urinary/thyroid/lung/breast/haem chapters predate most WHO 5th-edition volumes.
