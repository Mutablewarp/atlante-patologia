# Content schema

Status: PHASE 0 proposal, 2026-10-10. In Phase 1 these become Zod schemas in `src/lib/schema.ts` (`import { z } from 'astro/zod'`, Zod 4), imported by `src/content.config.ts` and by the Vitest validators. One schema, used in two places.

## 0. Shared types

```ts
const Id      = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/);   // language-neutral, used in URLs
const L       = z.object({ it: z.string().min(1), en: z.string().min(1) }); // every user-visible string
const LList   = z.object({ it: z.array(z.string()), en: z.array(z.string()) });
const ModuleId = z.string().regex(/^[gso]\d{2}$/);                // g01…o34 (SYLLABUS_MAP)
const Lens    = z.enum(['system','process','pattern','presentation','marker','group']); // 'az' is derived
const ReviewStatus = z.enum(['ai-generated-unreviewed','expert-reviewed']);
const Status  = z.enum(['draft','published']);                    // only 'published' is built
```

Rule: no user-visible string exists in only one language. A missing `it` or `en` fails the build.

## 1. Entity card — `src/content/entities/<id>/`

### 1a. `meta.yaml`

```ts
entity = z.object({
  id: Id,
  module: ModuleId,
  tier: z.enum(['core','extended']),
  kind: z.enum(['disease','lesion','process','concept']),
  names: z.object({
    it: z.string(), en: z.string(),
    latin: z.string().optional(),
    eponyms: z.array(z.string()).default([]),
    synonyms: LList,                    // incl. obsolete names, marked in text when relevant
    abbreviations: z.array(z.string()).default([]),
  }),
  summary: L,                           // one sentence; lists, search results, meta description
  lenses: z.object({                    // term ids from src/content/taxonomy/<lens>.yaml
    system: z.array(Id).min(1),
    process: z.array(Id).default([]),
    pattern: z.array(Id).default([]),
    presentation: z.array(Id).default([]),
    marker: z.array(Id).default([]),
    group: z.array(Id).min(1),
  }),                                   // validator: >= 3 distinct lenses non-empty (A–Z excluded)
  learningObjectives: z.array(L).min(1).max(6),
  prerequisites: z.array(Id).default([]),
  relations: z.array(z.object({ type: RelationType, target: Id, note: L.optional() })).default([]),
  quickCheck: z.array(z.object({ id: Id, q: L, a: L, kind: z.enum(['short','free']) })).min(3),
  selfExplain: z.array(L).default([]), // "why does X cause Y?" prompts
  chain: z.array(z.object({ pathology: L, sign: L, lab: L })).default([]), // chain trainer
  images: z.array(z.object({ id: Id, role: z.enum(['gross','micro','diagram','imaging','clinical']),
                             pairWith: Id.optional() })).default([]),
  reviewStatus: ReviewStatus,           // starts 'ai-generated-unreviewed'
  reviewedBy: z.object({ name: z.string(), date: z.coerce.date() }).optional(), // required iff expert-reviewed
  editionDependent: z.boolean(),
  editionNote: L.optional(),            // required iff editionDependent
  sources: z.array(z.object({ source: Id, chapter: z.string().optional(), pages: z.string().optional() })).min(1),
  lastUpdated: z.coerce.date(),
  status: Status,
});
```

Derived, not stored:
- `claimLedgerRef` = `docs/ledger/<id>.yaml`; the validator checks it exists.
- The A–Z letter.
- Inverse relations.

**Only a human sets `expert-reviewed`.** The Phase 1 validator rejects a commit where `reviewStatus` changes to `expert-reviewed` unless the commit author is in `REVIEWERS` (a committed list) and `reviewedBy` is filled. Agents never write this value.

### 1b. `en.md` and `it.md` — fixed sections

Frontmatter: `{ lang: 'en' | 'it', translatedFrom?: <sha256 of en.md at translation time> }`.

Body: exactly these H2 sections, in this order. The titles are the canonical localized strings in `src/i18n/<lang>.ts`. A small rehype step maps each title to a stable anchor id, so anchors match across languages.

| # | Anchor id | EN title | IT title (proposed) | Quick mode |
|---|---|---|---|---|
| 1 | `definition` | Definition and epidemiology | Definizione ed epidemiologia | ✓ (first paragraph) |
| 2 | `etiology` | Etiology and risk factors | Eziologia e fattori di rischio | |
| 3 | `pathogenesis` | Pathogenesis | Patogenesi | |
| 4 | `gross` | Gross morphology | Morfologia macroscopica | |
| 5 | `micro` | Microscopic morphology | Morfologia microscopica | |
| 6 | `ancillary` | Special stains, IHC and molecular findings | Colorazioni speciali, IIC e reperti molecolari | |
| 7 | `clinical` | Clinical presentation | Presentazione clinica | |
| 8 | `diagnosis` | Diagnosis, key lab and imaging | Diagnosi, laboratorio e imaging | |
| 9 | `prognosis` | Complications and prognosis | Complicanze e prognosi | |
| 10 | `differential` | Differential diagnosis | Diagnosi differenziale | ✓ |
| 11 | `high-yield` | High-yield summary | Punti chiave | ✓ |
| 12 | `traps` | Common misconceptions and exam traps | Errori comuni e trappole d'esame | ✓ |
| 13 | `mnemonics` | Mnemonics | Mnemotecniche | |
| — | `quick-check` | Quick check (rendered from `meta.quickCheck`) | Verifica rapida | ✓ |

A section that does not apply, such as gross morphology for a molecular process, contains one localized "not applicable" line. It is never omitted, so the structure stays parallel. Process/concept cards (`kind: process|concept`) may mark sections 4–9 `n/a`.

Authoring conventions inside the markdown:

- **Claim markers:** `<!--c:<entity>-c###-->` at the end of every sentence that states a fact. The same marker appears in both languages. The marker survives in HTML as a comment and is reused by the "report an error" link.
- **Numbers** (%, rates, survival, lab ranges) must have a claim marker whose ledger row has a source. Otherwise write "approximately" and the validator flags the line for REVIEW_QUEUE.
- **Sources differ:** `<aside class="sources-differ">…</aside>`, plus a REVIEW_QUEUE entry.
- **Edition-dependent passages:** `<aside class="edition">…</aside>`.
- **Differential section:** a markdown table with columns: entity | discriminating features | key test. Linked entities use `[[id]]`, which is resolved at build. Unpublished targets render as plain text with a "planned" label.
- **High-yield section:** a bullet list. **Bold** terms in it become cloze deletions (see §7).
- **Mnemonics:** must be original. The no-verbatim guard also checks this section.

## 2. Relation types

| Type | Symmetric | Display (EN / IT) on source → inverse on target |
|---|---|---|
| `sharesMechanism` | yes | Shares mechanism with / Condivide il meccanismo con |
| `differentialOf` | yes | Differential diagnosis / Diagnosi differenziale |
| `sameLesionOtherOrgan` | yes | Same lesion, other organ / Stessa lesione, altro organo |
| `sameMarker` | yes | Same marker / Stesso marcatore |
| `mimics` | no | Can mimic → Can be mimicked by / Può simulare → Può essere simulato da |
| `complicationOf` | no | Complication of → Possible complication / Complicanza di → Può complicarsi con |
| `causes` | no | Causes → Caused by / Causa → Causato da |
| `prerequisiteOf` | no | Prerequisite for → Builds on / Prerequisito per → Si basa su |

Validator rules:
- Targets must exist, either as an entity or in the `planned` list in `modules.yaml`.
- No self-relations.
- Symmetric relations declared once are mirrored; if declared on both sides, the notes must agree.
- Directed pairs must not contradict each other (A `causes` B and B `causes` A).
- `prerequisites` must form an acyclic graph.

## 3. Pattern Page — `src/content/patterns/<id>/`

`meta.yaml`:

```ts
pattern = z.object({
  id: Id, names: z.object({ it: z.string(), en: z.string() }), summary: L,
  process: Id,                                   // process-lens term
  matrix: z.object({
    columns: z.array(L).min(2),                  // e.g. organ, cause, gross, micro, outcome
    rows: z.array(z.object({ entity: Id, cells: z.array(L) })), // cells.length === columns.length - 1
  }),
  images: z.array(z.object({ id: Id, entity: Id })).default([]),
  reviewStatus: ReviewStatus, editionDependent: z.boolean(), sources: …, lastUpdated, status,
});
```

`en.md` / `it.md`: free sections (overview, mechanism, how to recognise it, pitfalls), with claim markers. The matrix renders as a table with a sticky first column and horizontal scroll on phones.

## 4. Question — `src/content/questions/<module>/<id>.yaml`

```ts
question = z.object({
  id: Id, module: ModuleId, entities: z.array(Id).min(1),
  kind: z.enum(['mcq','short','image-spot']),
  difficulty: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  tags: z.array(Id).default([]),
  stem: L,                                         // original clinical vignette
  image: Id.optional(),                            // required for image-spot
  options: z.array(z.object({
    id: z.string(), text: L, correct: z.boolean(), why: L,   // why it is right/wrong
  })).min(4).max(5),                               // mcq/image-spot: exactly one correct
  answer: L.optional(),                            // short-answer model answer
  backLink: z.object({ entity: Id, section: z.string() }),  // "review this" link
  claims: z.array(z.string()).default([]),          // ledger claim ids the item relies on
  reviewStatus: ReviewStatus, lastUpdated: z.coerce.date(), status: Status,
});
```

## 5. Image — `src/content/images/<id>.yaml` (+ file in `src/assets/images/`)

```ts
image = z.object({
  id: Id,
  file: z.string(),                                // path under src/assets/images
  kind: z.enum(['gross','micro','diagram','imaging','clinical']),
  sourceUrl: z.string().url(),                     // the FILE page, not a search page
  author: z.string().min(1),                       // the creator, not merely the uploader
  license: z.enum(['original','PD','CC0-1.0','CC-BY-2.0','CC-BY-2.5','CC-BY-3.0','CC-BY-4.0',
                   'CC-BY-SA-2.0','CC-BY-SA-2.5','CC-BY-SA-3.0','CC-BY-SA-4.0']),
  licenseUrl: z.string().url(),
  retrievedAt: z.coerce.date(),
  modifications: z.string(),                       // 'none' or what we changed (crop, labels…)
  attributionText: z.string().min(1),              // exact credit line shown under the image
  patientIdentifiable: z.literal(false),
  ownerApproved: z.boolean().default(false),        // must be true for any CC-BY-SA-*
  verifiedBy: z.object({ who: z.enum(['agent','human']), name: z.string(), date: z.coerce.date() }),
  stain: z.string().optional(), magnification: z.string().optional(),
  caption: L,                                      // didactic: what to look at, key finding, approach (low → high power)
  alt: L,
  annotations: z.array(z.object({
    id: Id, label: L, revealOrder: z.number().int().min(1),
    shape: z.object({ type: z.enum(['circle','rect','polygon']), coords: z.array(z.number().min(0).max(1)) }),
  })).default([]),                                 // normalized coords; drive labels, progressive reveal, occlusion
});
```

The Credits page and per-image credit lines are generated from these files. An image without complete data cannot be referenced. The entity uses a placeholder, and the gap is logged in `docs/MISSING_ASSETS.md`.

## 6. Other collections

| Collection | File | Key fields |
|---|---|---|
| Glossary | `glossary/<id>.yaml` | `id, term: L, definition: L (≤ 40 words), aliases: LList, see: Id[]`. Popovers work by tap, keyboard and hover. |
| Learning path | `paths/<id>.yaml` | `id, kind: 'vertical'\|'horizontal', title: L, description: L, steps: ({entity: Id}\|{pattern: Id})[]` |
| Taxonomy (lens terms) | `taxonomy/<lens>.yaml` | `lens, label: L, terms: [{ id, label: L, parent?: Id, order }]` |
| Modules | `modules.yaml` | `id, section: 'I'\|'II'\|'III', label: L, order, status: 'planned'\|'published', refPages, planned: [{ id, names: L }]` (feeds the Roadmap page) |
| Sources | `sources.yaml` | `id, title, edition, year, publisher, kind: 'textbook'\|'standard'\|'article', doi?, pmid?, url?, existsVerified: { via: 'crossref'\|'pubmed'\|'publisher', date }` |

## 7. Flashcards (generated at build, never hand-authored)

| Kind | Generated from | Front / back |
|---|---|---|
| `cloze` | each bullet in `high-yield` with **bold** terms | bullet with each bold term blanked in turn / full bullet |
| `qa` | `meta.quickCheck` | q / a |
| `occlusion` | image `annotations` | image with one label hidden / label + caption |

- **Card id:** `<entity>:<kind>:<sha1(en source text)[0:10]>`. The id is shared by both languages, so review history follows the learner across a language switch. Editing the English source creates a new card, and the old card's history is archived, not lost.
- **Output:** `/[lang]/data/cards/<module>.json`.

## 8. Claim ledger — `docs/ledger/<entity-id>.yaml`

The ledger never stores quoted reference text.

```yaml
entity: coagulative-necrosis
claims:
  - claimId: coagulative-necrosis-c001
    section: micro
    statement: "<our own wording, EN>"
    sourceRef: { source: rubin-8e, chapter: "1", pages: "41-42" }   # printed pages
    status: verified            # verified | contradicted | not-found-in-reference | beyond-reference | sources-differ
    secondSource:               # required for not-found-in-reference, beyond-reference, sources-differ
      source: <sources.yaml id> # must have existsVerified
      locator: "<section/table/page>"
    verifiedBy: agent           # agent | human
    verifier: "<agent run id or reviewer name>"
    date: 2026-10-10
```

Gate rules:
- `contradicted` blocks publishing.
- `not-found-in-reference` and `beyond-reference` need `secondSource`, or the claim is removed.
- `sources-differ` must also appear as an aside in the text and in REVIEW_QUEUE.
- The verifier is a separate sub-agent with fresh context. It receives the card text and reference pages, never the author agent's reasoning.

## 9. Example (illustrative only, not reviewed content)

```
src/content/entities/coagulative-necrosis/
  meta.yaml   # module: g01, tier: core, kind: process,
              # lenses: { system: [general], process: [cell-death], pattern: [necrosis-coagulative], group: [degenerative-ischemic] }
              # relations: [{ type: sameLesionOtherOrgan, target: myocardial-infarction }, { type: differentialOf, target: caseous-necrosis }]
  en.md       # 13 fixed sections with <!--c:…--> markers
  it.md       # same structure; translatedFrom: <hash of en.md>
docs/ledger/coagulative-necrosis.yaml
```
