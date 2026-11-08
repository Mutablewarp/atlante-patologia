# Navigation spec

Status: PHASE 0 proposal, 2026-10-10; site map, badges and footer brought in line with the code on 2026-11-04; tablet and desktop navigation (chapter index, section list, touch targets, reading layout) on 2026-11-08 (D064–D068). Platform guidance verified in [VERIFIED_FACTS.md](VERIFIED_FACTS.md) §H–I.

## 1. Primary destinations

Five destinations: **Home · Atlas · Study · Search · Me**. Material 3 recommends a navigation bar with 3–5 destinations. Apple HIG sets no fixed count, asks for labels, and warns that overflow creates a "More" tab. Five fits both.

| Width class | Breakpoint | Pattern |
|---|---|---|
| Compact (phones) | < 600 px | Bottom tab bar with icons, and labels always visible. |
| Medium (tablets) | 600–1023 px | Navigation rail on the left, labels visible (13 px). Top bar: brand, on entity pages a **Capitolo/Chapter** button that opens the chapter index in a modal dialog (D066; icon only below 740 px, its name kept), the command-palette button (with its `Ctrl/⌘ K` hint from 740 px, except at the largest reading size), language, theme. The tools keep their width; the site name gives way, down to "Atlante". |
| Expanded (desktop) | ≥ 1024 px | Collapsible sidebar (destinations with 16 px labels + contextual module tree) and a top bar (global search field showing `Ctrl/⌘ K`, language switch, theme). The search field replaces the palette button; the shortcut still opens the palette. With the sidebar collapsed, entity pages get the Chapter button back. |

Rules for every width:
- **Current destination:** filled icon, bold label, an indicator bar, and `aria-current="page"`. Never colour alone.
- **Targets:** nav items are ≥ 44 × 44 CSS px. Every other control is ≥ 24 × 24 CSS px, the WCAG 2.2 SC 2.5.8 AA minimum. On touch screens from 600 px (`pointer: coarse`, iPads) chips, small buttons, the reading-mode control, section chips and the side list, lens terms, matrix thumbnails, breadcrumb and pager links and the chapter index are ≥ 44 px tall (SC 2.5.5), by padding at the same type size; breadcrumb and pager links keep their line's height. Phones keep their sizes (D068).
- **Focus visible:** inside a pill group (reading mode, language) or a list that scrolls (chip strip, side list, chapter index) the ring is drawn inside the control or the list leaves room for it, so it is never clipped (SC 2.4.7).
- **Sticky bars** are opaque `--paper`: no text shows through them.
- **Safe areas:** `viewport-fit=cover`, and the bottom bar pads by `env(safe-area-inset-bottom)`.
- **Focus not obscured (SC 2.4.11 AA):** sticky bar heights are CSS variables reused in `scroll-padding-top/bottom`. A Playwright test tabs through each template and asserts the focused element's box never sits under a sticky bar.
- **Per-tab back stack:** this is a multi-page static site, so each tab remembers its last URL in `sessionStorage`.
  - Tapping a tab returns to where you were in it.
  - Tapping the active tab again goes to its root.
  - Browser Back stays native and correct, because there is no history rewriting.

## 2. Lenses (vertical and horizontal access)

| Lens | URL key | Terms (examples) | Source of membership |
|---|---|---|---|
| (a) Organ system | `system` | general, vessels, heart, lung, GI, liver… (≈ 20) | `meta.lenses.system` |
| (b) Process / mechanism | `process` | cell death, adaptation, acute inflammation, granulomatous inflammation, thrombosis, neoplasia… | `meta.lenses.process` |
| (c) Morphologic pattern | `pattern` | coagulative necrosis, granuloma, fibrinoid change, signet-ring cells, small round blue cells… | `meta.lenses.pattern` |
| (d) Clinical presentation | `presentation` | jaundice, hematuria, nephrotic syndrome, dyspnea, mass lesion… | `meta.lenses.presentation` |
| (e) Marker | `marker` | IHC (CK7, CD20…), molecular (BRAF V600E…), lab (ANCA, AFP…) | `meta.lenses.marker` |
| (f) Disease group | `group` | neoplastic, infectious, vascular, immune, genetic, degenerative, metabolic, toxic/environmental, developmental | `meta.lenses.group` |
| (g) A–Z / glossary | `az` | letters; entities and glossary terms, both languages, synonyms and eponyms | derived |

Build gate: every entity has ≥ 3 non-empty lenses among (a)–(f). A–Z is excluded because it would make the check trivially true.

## 3. Site map and URL scheme

All ids in URLs are language-neutral, so switching language swaps only the `/{lang}/` prefix (it ↔ en). `base` is prefixed by the `url()` helper.

| URL | Page |
|---|---|
| `/` | Language entry. JS picks saved preference, then `navigator.languages`, then the default, and redirects. Without JS: two large links. |
| `/{lang}/` | Home: resume, today's review count, recently viewed, module progress, learning paths, disclaimer banner (first visit). |
| `/{lang}/atlas/` | Lens switcher with **term lists inline** for every lens, plus the module grid (syllabus order, published/planned). |
| `/{lang}/atlas/{lens}/` | All terms of one lens (tree when terms have parents). |
| `/{lang}/atlas/{lens}/{term}/` | Entities for that term in syllabus order; previous/next term. |
| `/{lang}/atlas/az/` | A–Z of entities and glossary terms; `#term-<id>` anchors. |
| `/{lang}/e/{id}/` | **Canonical entity page.** |
| `/{lang}/pattern/{id}/` | Pattern Page with comparison matrix. |
| `/{lang}/pathways/{id}/` | Molecular pathway (O9, D054): step list, animated 2D diagram, 3D structure viewer loaded on demand, structure provenance and sources. |
| `/{lang}/compare/?ids=a,b,c` | Comparison table of 2–4 entities (client-side from the index JSON). |
| `/{lang}/differential/` | Differential builder. |
| `/{lang}/map/` | Concept map, with an equivalent tree/list view on the same page as an accessible toggle. |
| `/{lang}/paths/`, `/{lang}/paths/{id}/` | Learning paths with progress. |
| `/{lang}/study/` | Study hub: due today, modes, last-week revision entry. |
| `/{lang}/study/review/` | FSRS flashcard queue. |
| `/{lang}/study/quiz/?mode=topic\|mixed\|exam\|weak&module=…` | MCQs, free recall, timed exam. |
| `/{lang}/study/images/` | Spot the diagnosis, gross/micro pairs, look-alikes. |
| `/{lang}/study/chain/` | Pathology → sign → lab trainer. |
| `/{lang}/study/planner/` | Exam date and weekly hours → schedule. |
| `/{lang}/study/oral/` | Oral exam simulator: three questions across the programme, self-assessment rubric. |
| `/{lang}/search/?q=` | Full search with lens filters (Pagefind). |
| `/{lang}/me/` | Honest dashboard: coverage, mastery, review debt, weak spots. |
| `/{lang}/me/{bookmarks\|notes\|errors\|data}/` | Personal layer. `data/` holds export/import, storage meter and persistence status. |
| `/{lang}/me/offline/` | Offline packs per chapter (opt-in), storage meter and persistence status. |
| `/{lang}/offline/` | Offline fallback the service worker serves when a page is neither online nor saved. |
| `/{lang}/about/…` | index, method (incl. AI disclosure), credits, licenses, evidence, accessibility, privacy, disclaimer, roadmap, reading-list, report-an-error. |
| `/{lang}/data/…` | Static JSON for the client tools: `index.json`, `quick.json`, `study.json`, `oral.json`, `cards/{module}.json`, `questions/{module}.json`. |
| `/404.html` | Search box, suggestions derived from the failed path, links to Atlas and Home. |

Interpretation recorded in [DECISIONS.md](DECISIONS.md) D010: the brief's `/{lang}/atlas/{lens}/{slug}/` is the **lens-term page**. Entities live only at `/{lang}/e/{id}/`, which avoids duplicate pages and keeps one canonical URL.

**Lens context.** Links from a lens-term page add `?via={lens}:{term}`. On the entity page, a small island reads it and replaces the breadcrumb and Prev/Next with that lens's order. Without the parameter (deep link, no JS), the server-rendered default is the entity's primary organ-system order. `rel=canonical` always points to the URL without the query.

**SEO/i18n head:** `<html lang>`, `rel=alternate hreflang="it"|"en"|"x-default"` (x-default → `/`), and a sitemap with alternates.

## 4. Entity page anatomy

Header contents:
- Names (it / en / Latin / eponyms / synonyms).
- Tags: lens chips, each a link.
- Badges: last updated, edition-dependent (when set), and "Expert-reviewed" with the reviewer's name only after a human review. There is no per-page AI badge (O11, D052): the AI line is in the footer of every page.
- Buttons: Quick/Full toggle, "Add to review", "Quiz me on this", "Compare with…", bookmark, print.
- Folds (D065): with JavaScript the lens chips ("Lenti (n)"), the less used tools ("Strumenti") and the learning objectives fold behind toggles at every width, closed from the first paint; from 768 px one row holds Quick/Full, A−/A+, bookmark, quiz and Tools. Without JavaScript everything shows.

Body contents:
- 13 fixed sections plus Quick check.
- Each section collapsible, with "Expand all".
- Each section opens with an optional "Try to recall first" block: a generic localized prompt, with the answer hidden until revealed.

Also on the page:
- Related panel ("Schede correlate", `#related`), grouped by relation type.
- Breadcrumb, and Prev/Next within the current lens (`#card-nav`). From 600 px the same previous/next pair sits beside the breadcrumb ("← Necrosi caseosa · Necrosi colliquativa →", D066).
- Section list: the chip strip below 1024 px, the side list from 1024 px. From 600 px it ends with "Schede correlate" and "Successiva: ‹name› →" (the block at the end of the card); from 1024 px a "Successiva →" link under the side list opens the next card. In a lens context (`?via=`) both name that lens's next card. The current entry is the section under a reading line 8 px below where an anchor puts its heading (`scroll-padding-top`); a tapped entry is marked at once and the spy waits until the scroll settles; at the end of the page a tapped section on screen, or else the last one, is current.
- Two skip links: "Vai al contenuto" (`#main`) and "Vai al testo della scheda" (the first section); pattern pages: "Vai al testo del quadro".
- Deep-linkable section anchors (`#micro` and so on).
- A print stylesheet that produces a one-page summary (high-yield, differential, traps).

Reading layout (D068):
- 600–1023 px: one centred column (46rem), chip strip under the top bar, at most 4.35rem tall on touch screens (`--chips-h` feeds `scroll-padding-top`). The strip fades at the edges that hide chips; the current chip is filled in hematoxylin.
- 1024–1279 px: side list 9.5rem with a 1rem gap, so the text keeps 60 characters a line with the sidebar open (61 in WebKit and 64 in Chromium at 1024 px; 52 before).
- ≥ 1280 px: the text column is the measure (31em) plus the room of the section toggles, the side list sits 2rem beside it, and the card (breadcrumb, header, text, list) is one block centred in the page. Pattern pages keep their block on the left, above the full-width matrix.
- When the side list is taller than the screen (touch sizes in landscape, the largest reading size) only its entries scroll: the title and the "Successiva →" link stay in view, the current entry is kept in the middle and the edges that hide entries fade.

### Phone (375–430 px)

```
┌──────────────────────────────┐
│ ‹ Atlas › Heart › …     ⋮    │  breadcrumb (truncates from the left)
│ Coagulative necrosis         │
│ Necrosi coagulativa · lat. … │  all names visible (search + learning)
│ [Upd 2026-…] [◷ Edition]     │  badges (text + icon, not colour only)
│ (Quick|Full) (+Review) (Quiz)│
├──────────────────────────────┤
│ ◀ Def  Path  Gross  Micro …▶ │  sticky chip row, horizontal scroll
├──────────────────────────────┤
│ ▸ Try to recall first…       │
│ ▾ Definition and epidemiology│
│   text…                       │
│ ▸ Etiology and risk factors  │
│   …                          │
│ [Jump to ▴] → bottom sheet   │  full section list + "Expand all"
├──────────────────────────────┤
│ Related: Differential (3) ▸  │
│ ◀ Prev in "Heart"   Next ▶   │
├──────────────────────────────┤
│ ⌂ Home  ▦ Atlas  ✎ Study  ⌕  ☺│  bottom tab bar, labels always on
└──────────────────────────────┘
```

### Tablet (600–1023 px)

```
┌───┬──────────────────────────────────────────┐
│   │ Atlante  [☰ Capitolo] [⌕ ⌘K]  IT|EN ◐    │  top bar; Capitolo → chapter dialog
│ ⌂ │ ‹ Atlas › General  ← Caseous · Liquef. → │  breadcrumb + previous/next card
│ ▦ │ Coagulative necrosis   badges  [Lenti ▾] │
│ ✎ │ [Quick|Full] [A−][A+] [☆] [Quiz] [Tools] │  one row from 768 px
│ ⌕ │ chips: Def · Path · … · Related · Next → │  (sticky, fades at the edges)
│ ☺ │──────────────────────────────────────────│
│   │ sections…                                │
│   │ Related (grouped) — 2 columns            │
│rail ◀ Prev            Next ▶   #card-nav     │
└───┴──────────────────────────────────────────┘
```

### Desktop (≥ 1024 px)

```
┌───────────────────────────────────────────────────────────────────────┐
│ Logo   [ Search atlas…            ⌘K ]          IT|EN   ◐   ☰        │ top bar
├──────────────┬──────────────────────────────────────┬─────────────────┤
│ Home         │ Atlas › Organ system › General ›      │ On this page    │
│ Atlas ▾      │ Coagulative necrosis                  │ • Definition    │
│  g01 Cell…   │ names · badges · actions              │ • Etiology      │
│   • Adapt…   │                                       │ ▸ Pathogenesis  │ scroll-spy
│   • Necro… ◀ │ sections (collapsible, Expand all)    │ • Gross         │
│ Study        │                                       │ …               │
│ Search       │ Related (grouped by relation type)    │ Related cards   │
│ Me           │ ◀ Prev in lens            Next ▶      │ Next: ‹name›    │
│ (collapse «) │                                       │ ─ Successiva →  │ the next card itself
├──────────────┴──────────────────────────────────────┴─────────────────┤
│ Educational use only — not for diagnosis or treatment. Errors possible. Report ▸ │ footer on every page
│ AI-generated texts, checked automatically; no expert review yet. Method ▸        │ AI line (O11)
└───────────────────────────────────────────────────────────────────────┘
```

## 5. Horizontal learning layer

| Feature | Behaviour | Accessibility |
|---|---|---|
| Relation graph | 8 typed relations (CONTENT_SCHEMA §2); related panel grouped by type | Plain lists of links |
| Pattern Pages | Overview + cross-organ matrix + images per organ | Real `<table>` with `<th scope>`; sticky first column; horizontal scroll region has a label and is keyboard-focusable |
| Differential builder | Pick findings from 4 facets (organ = system lens, pattern, marker, presentation). Candidates are ranked by overlap count (ties broken by tier, then syllabus order). Each row shows matched/unmatched findings and links to the entity's differential table | Checkbox groups in fieldsets; results in a live region announcing the count |
| Compare | 2–4 entities, rows = fixed sections (Quick text) | Same table rules as Pattern Pages |
| Concept map | Force/graph view of relations | **Equivalent tree/list view** with the same nodes and edges as nested lists, keyboard-navigable; the list is the default when `prefers-reduced-motion` is set or the screen is narrow |
| Learning paths | Vertical (foundations → system) and horizontal (one process across systems); progress from reading + review state | Ordered list with completion state in text |

## 6. Orientation

- Breadcrumbs on every page below a top-level destination.
- "You are here" highlight in the module tree: the sidebar copy (≥ 1024 px) opens with the current card in the middle of its scrolling box (its `scrollTop` only, the page never moves) and fades the edges that hide cards; the chapter dialog (600–1023 px, and ≥ 1024 px with the sidebar collapsed) opens with focus on the current card. A native modal `<dialog>`: focus stays inside, Esc or a click on the backdrop closes it, focus returns to the button.
- Card order in every list (chapter index, chapter and lens-term lists, previous/next): module order, then the name in the language of the page (`localeCompare`), because the data has no order of cards inside a module (D067).
- Recently viewed: last 20, stored in IndexedDB.
- "Resume where you left off": last entity plus section anchor.
- Per-module progress: sections read and cards mastered, shown as text and bar.
- Helpful 404: see §3.
- Language switch: same page in the other language. The target always exists, because the parity gate publishes both languages in the same commit. Planned entities have no pages in either language.

## 7. Automated navigation validation

Tests run on the built `dist/` (Vitest suites in `tests/dist/`) and in browsers (Playwright).

| Check | Definition |
|---|---|
| No orphans | Every page except `/` has ≥ 1 inbound link from **content areas**. Header, nav and footer are excluded via `data-nav="global"`. |
| No dead ends | Every page has ≥ 1 outbound content-area link. |
| ≤ 3 taps | BFS from `/{lang}/` over all links: every entity is reachable in ≤ 3 steps through at least one lens (Home → Atlas → lens-term → entity). |
| Hop distance | Entity-to-entity shortest paths over content links. The report (median, max, unreachable pairs) is written to `reports/nav-hops.json`. |
| Links and anchors | Every internal `href` resolves to a file in `dist/`; every `#fragment` exists on the target page. |
| Symmetric relations | Pre-build content check (CONTENT_SCHEMA §2). |
| Viewports | Playwright at 375×667, 390×844, 768×1024, 1280×800, 1920×1080 × Chromium, Firefox, WebKit. Nav pattern by width, no horizontal page scroll, target sizes. |
| Keyboard-only | Skip link → (reading pages) skip link to the text → main → section TOC → content → related → footer. Every interactive control is reachable, the order is logical, focus is visible (rings whole inside pill groups and scrolling lists) and not obscured. |
| Touch targets | On a touch screen at 820 × 1180 and 1180 × 820: every chip, small button, section entry, breadcrumb and pager link, lens term, matrix thumbnail and chapter-index entry ≥ 44 px tall; the first sentence of a card on the first screen; `--chips-h` equal to the strip; phone sizes unchanged. |
| Section list | The tapped entry is the one marked, short sections included; the last entries and the link under the side list follow the lens context; the side list stays on the screen and keeps its current entry in view. |
| Measure | 62–70 characters per line at the test widths; ≥ 60 at 1024 and 1180 px; from 1280 px no band wider than 6rem between text and list, and the block centred. |
| axe | Every page template at all 5 viewports, light and dark. |
| Manual screen-reader checklist | For the owner: VoiceOver (iOS, macOS), TalkBack, NVDA. Delivered in Phase 5 as `docs/SR_CHECKLIST.md`. |
