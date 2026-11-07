/**
 * Content schemas (CONTENT_SCHEMA.md). One definition, used by
 * src/content.config.ts and by Vitest validators.
 */
import { z } from 'astro/zod';
import { SECTIONS } from '../i18n/sections.ts';

// ── §0 Shared types ──────────────────────────────────────────────────────────
export const Id = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'ids are lowercase-kebab-case');
export const L = z.object({ it: z.string().min(1), en: z.string().min(1) });
export const LList = z.object({ it: z.array(z.string()), en: z.array(z.string()) });
export const ModuleId = z.string().regex(/^[gso]\d{2}$/);
export const LENSES = ['system', 'process', 'pattern', 'presentation', 'marker', 'group'] as const;
export const Lens = z.enum(LENSES);
export const ReviewStatus = z.enum(['ai-generated-unreviewed', 'expert-reviewed']);
export const Status = z.enum(['draft', 'published']);

export type LensId = z.infer<typeof Lens>;

// ── §2 Relation types ────────────────────────────────────────────────────────
export const RELATION_TYPES = [
  'sharesMechanism',
  'differentialOf',
  'sameLesionOtherOrgan',
  'sameMarker',
  'mimics',
  'complicationOf',
  'causes',
  'prerequisiteOf',
] as const;
export const RelationType = z.enum(RELATION_TYPES);
export type RelationTypeId = z.infer<typeof RelationType>;

const SourceRef = z.object({ source: Id, chapter: z.string().optional(), pages: z.string().optional() });
/** Only names listed in the repo-root REVIEWERS file are accepted (content gate, docs/CONTENT_GATES.md). */
const ReviewedBy = z.object({ name: z.string().min(1), date: z.coerce.date() });

// ── §1a Entity meta ──────────────────────────────────────────────────────────
export const entitySchema = z
  .object({
    id: Id,
    module: ModuleId,
    tier: z.enum(['core', 'extended']),
    kind: z.enum(['disease', 'lesion', 'process', 'concept']),
    names: z.object({
      it: z.string().min(1),
      en: z.string().min(1),
      latin: z.string().optional(),
      eponyms: z.array(z.string()).default([]),
      synonyms: LList,
      abbreviations: z.array(z.string()).default([]),
    }),
    summary: L,
    lenses: z.object({
      system: z.array(Id).min(1),
      process: z.array(Id).default([]),
      pattern: z.array(Id).default([]),
      presentation: z.array(Id).default([]),
      marker: z.array(Id).default([]),
      group: z.array(Id).min(1),
    }),
    learningObjectives: z.array(L).min(1).max(6),
    prerequisites: z.array(Id).default([]),
    relations: z.array(z.object({ type: RelationType, target: Id, note: L.optional() })).default([]),
    quickCheck: z.array(z.object({ id: Id, q: L, a: L, kind: z.enum(['short', 'free']) })).min(3),
    selfExplain: z.array(L).default([]),
    chain: z.array(z.object({ pathology: L, sign: L, lab: L })).default([]),
    /**
     * Possible oral exam questions: questions only, no new facts. `focus` names
     * the sections where the learner checks the answer; level 1 basic … 3 advanced.
     */
    examQuestions: z
      .array(
        z.object({
          it: z.string().min(1),
          en: z.string().min(1),
          focus: z.array(z.enum(SECTIONS.map((s) => s.id) as [string, ...string[]])).min(1),
          level: z.union([z.literal(1), z.literal(2), z.literal(3)]),
        }),
      )
      .default([]),
    images: z
      .array(
        z.object({
          id: Id,
          role: z.enum(['gross', 'micro', 'diagram', 'imaging', 'clinical']),
          pairWith: Id.optional(),
        }),
      )
      .default([]),
    reviewStatus: ReviewStatus,
    reviewedBy: ReviewedBy.optional(),
    editionDependent: z.boolean(),
    editionNote: L.optional(),
    /** WHO tumour classification the card follows; `checked` is the date a HUMAN last confirmed it (docs/WHO_WATCH.md). */
    classification: z
      .object({ source: Id, volume: z.number().int().positive().optional(), checked: z.coerce.date() })
      .optional(),
    sources: z.array(SourceRef).min(1),
    lastUpdated: z.coerce.date(),
    status: Status,
  })
  .superRefine((e, ctx) => {
    if (e.reviewStatus === 'expert-reviewed' && !e.reviewedBy)
      ctx.addIssue({ code: 'custom', path: ['reviewedBy'], message: 'reviewedBy is required for expert-reviewed' });
    if (e.reviewStatus !== 'expert-reviewed' && e.reviewedBy)
      ctx.addIssue({ code: 'custom', path: ['reviewedBy'], message: 'reviewedBy only allowed when expert-reviewed' });
    if (e.editionDependent && !e.editionNote)
      ctx.addIssue({ code: 'custom', path: ['editionNote'], message: 'editionNote is required when editionDependent' });
    const nonEmpty = LENSES.filter((l) => e.lenses[l].length > 0).length;
    if (nonEmpty < 3)
      ctx.addIssue({ code: 'custom', path: ['lenses'], message: `needs >= 3 non-empty lenses, has ${nonEmpty}` });
    if (e.relations.some((r) => r.target === e.id))
      ctx.addIssue({ code: 'custom', path: ['relations'], message: 'self-relation' });
  });
export type Entity = z.infer<typeof entitySchema>;

// ── §1b Entity body frontmatter (en.md / it.md) ──────────────────────────────
export const entityBodySchema = z.object({
  lang: z.enum(['it', 'en']),
  translatedFrom: z.string().optional(),
});

// ── §3 Pattern page ──────────────────────────────────────────────────────────
export const patternSchema = z
  .object({
    id: Id,
    names: z.object({ it: z.string().min(1), en: z.string().min(1) }),
    summary: L,
    process: Id,
    matrix: z.object({
      columns: z.array(L).min(2),
      rows: z.array(z.object({ entity: Id, cells: z.array(L) })),
    }),
    images: z.array(z.object({ id: Id, entity: Id })).default([]),
    reviewStatus: ReviewStatus,
    reviewedBy: ReviewedBy.optional(),
    editionDependent: z.boolean(),
    sources: z.array(SourceRef).min(1),
    lastUpdated: z.coerce.date(),
    status: Status,
  })
  .superRefine((p, ctx) => {
    p.matrix.rows.forEach((r, i) => {
      if (r.cells.length !== p.matrix.columns.length - 1)
        ctx.addIssue({ code: 'custom', path: ['matrix', 'rows', i], message: 'cells.length must be columns.length - 1' });
    });
  });

// ── §4 Question ──────────────────────────────────────────────────────────────
export const questionSchema = z
  .object({
    id: Id,
    module: ModuleId,
    entities: z.array(Id).min(1),
    kind: z.enum(['mcq', 'short', 'image-spot']),
    difficulty: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    tags: z.array(Id).default([]),
    stem: L,
    image: Id.optional(),
    options: z
      .array(z.object({ id: z.string(), text: L, correct: z.boolean(), why: L }))
      .min(4)
      .max(5),
    answer: L.optional(),
    backLink: z.object({ entity: Id, section: z.string() }),
    claims: z.array(z.string()).default([]),
    reviewStatus: ReviewStatus,
    reviewedBy: ReviewedBy.optional(),
    lastUpdated: z.coerce.date(),
    status: Status,
  })
  .superRefine((q, ctx) => {
    if (q.kind === 'image-spot' && !q.image)
      ctx.addIssue({ code: 'custom', path: ['image'], message: 'image-spot requires image' });
    if (q.kind !== 'short' && q.options.filter((o) => o.correct).length !== 1)
      ctx.addIssue({ code: 'custom', path: ['options'], message: 'exactly one correct option' });
  });

// ── §5 Image ─────────────────────────────────────────────────────────────────
export const IMAGE_LICENSES = [
  'original', 'PD', 'CC0-1.0', 'CC-BY-2.0', 'CC-BY-2.5', 'CC-BY-3.0', 'CC-BY-4.0',
  'CC-BY-SA-2.0', 'CC-BY-SA-2.5', 'CC-BY-SA-3.0', 'CC-BY-SA-4.0',
] as const;
export const IMAGE_SECTIONS = ['transverse', 'longitudinal', 'oblique', 'frozen', 'paraffin', 'smear', 'cytospin', 'other'] as const;
export const IMAGE_OBJECTIVES = ['2x', '4x', '10x', '20x', '40x', '60x', '100x'] as const;
export const imageSchema = z
  .object({
    id: Id,
    file: z.string().min(1),
    /** Italian copy of an original diagram whose drawing carries text (`file` is the English one); see image-meta.ts `fileFor`. */
    fileIt: z.string().min(1).optional(),
    kind: z.enum(['gross', 'micro', 'diagram', 'imaging', 'clinical']),
    sourceUrl: z.url(),
    author: z.string().min(1),
    license: z.enum(IMAGE_LICENSES),
    licenseUrl: z.url(),
    retrievedAt: z.coerce.date(),
    /** 'none', or what we changed (crop, resize, re-encoding…) in both languages: it is shown in the credit line. */
    modifications: z.union([z.literal('none'), L]),
    /** Exact credit line: a third party's as its source asks for it; ours (license 'original') in both languages. */
    attributionText: z.union([z.string().min(1), L]),
    patientIdentifiable: z.literal(false),
    ownerApproved: z.boolean().default(false),
    verifiedBy: z.object({ who: z.enum(['agent', 'human']), name: z.string().min(1), date: z.coerce.date() }),
    /** Images of the same lesion (other stains, sections, magnifications) share a group id; the viewer offers a switch. */
    group: Id.optional(),
    /** As the source states it; image-meta.ts `stainCode()` maps it to the controlled list. */
    stain: z.string().optional(),
    /** As the source states it; `powerOf()` reads low / medium (intermediate) / high power from it. */
    magnification: z.string().optional(),
    /** Objective, only when the source states it. */
    objective: z.enum(IMAGE_OBJECTIVES).optional(),
    /** Microns per pixel of this file, only when the source states it; enables the scale bar. */
    mpp: z.number().positive().optional(),
    section: z.enum(IMAGE_SECTIONS).optional(),
    orientation: L.optional(),
    /** One short "how to look at this slide" hint shown under the viewer. */
    lookFor: L.optional(),
    caption: L,
    alt: L,
    annotations: z
      .array(
        z.object({
          id: Id,
          label: L,
          revealOrder: z.number().int().min(1),
          shape: z.object({
            type: z.enum(['circle', 'rect', 'polygon']),
            coords: z.array(z.number().min(0).max(1)),
          }),
        }),
      )
      .default([]),
    /** Fixture images use `draft` so they never reach a production build (credits, study pages). */
    status: Status.default('published'),
  })
  .superRefine((img, ctx) => {
    if (img.license.startsWith('CC-BY-SA') && !img.ownerApproved)
      ctx.addIssue({ code: 'custom', path: ['ownerApproved'], message: 'CC BY-SA images need ownerApproved: true' });
    if (img.license === 'original' && typeof img.attributionText === 'string')
      ctx.addIssue({ code: 'custom', path: ['attributionText'], message: 'our own images credit us in both languages ({ it, en })' });
    if (img.fileIt && img.license !== 'original')
      ctx.addIssue({ code: 'custom', path: ['fileIt'], message: 'only our own diagrams have an Italian copy' });
  });

// ── §6 Other collections ─────────────────────────────────────────────────────
export const glossarySchema = z.object({
  id: Id,
  term: L,
  definition: L,
  aliases: LList.default({ it: [], en: [] }),
  see: z.array(Id).default([]),
});

export const pathSchema = z.object({
  id: Id,
  kind: z.enum(['vertical', 'horizontal']),
  title: L,
  description: L,
  steps: z.array(z.union([z.object({ entity: Id }), z.object({ pattern: Id })])).min(1),
});

export const taxonomySchema = z.object({
  lens: Lens,
  label: L,
  terms: z.array(
    z.object({
      id: Id,
      label: L,
      parent: Id.optional(),
      order: z.number().int(),
    }),
  ),
});
export type Taxonomy = z.infer<typeof taxonomySchema>;

export const moduleSchema = z.object({
  id: ModuleId,
  section: z.enum(['I', 'II', 'III']),
  label: L,
  order: z.number().int(),
  status: z.enum(['planned', 'published']),
  refPages: z.string().optional(),
  planned: z.array(z.object({ id: Id, names: L })).default([]),
});
export type Module = z.infer<typeof moduleSchema>;

/** Publication status of a standard (WHO volumes go online as beta before print). */
export const SOURCE_STATUSES = ['print', 'online-beta', 'forthcoming', 'superseded'] as const;
export const sourceSchema = z
  .object({
    id: Id,
    title: z.string().min(1),
    authors: z.string().optional(),
    edition: z.number().int().optional(),
    year: z.number().int(),
    publisher: z.string().optional(),
    journal: z.string().optional(),
    kind: z.enum(['textbook', 'standard', 'article']),
    doi: z.string().optional(),
    pmid: z.string().optional(),
    url: z.url().optional(),
    // Standards only (e.g. WHO Classification of Tumours volumes); set only where verified.
    series: z.string().min(1).optional(),
    volume: z.number().int().positive().optional(),
    status: z.enum(SOURCE_STATUSES).optional(),
    supersedes: Id.optional(),
    isbn: z.string().regex(/^97[89]-\d{1,5}-\d{1,7}-\d{1,7}-\d$/, 'ISBN-13 with hyphens').optional(),
    existsVerified: z.object({ via: z.enum(['crossref', 'pubmed', 'publisher']), date: z.coerce.date() }),
  })
  .superRefine((s, ctx) => {
    for (const k of ['series', 'volume', 'status', 'supersedes'] as const)
      if (s[k] !== undefined && s.kind !== 'standard')
        ctx.addIssue({ code: 'custom', path: [k], message: `${k} is only allowed on kind: standard` });
    if (s.supersedes === s.id) ctx.addIssue({ code: 'custom', path: ['supersedes'], message: 'a source cannot supersede itself' });
  });
export type Source = z.infer<typeof sourceSchema>;

// ── §8 Claim ledger — docs/ledger/<entity-or-pattern-id>.yaml ────────────────
export const CLAIM_STATUSES = ['verified', 'contradicted', 'not-found-in-reference', 'beyond-reference', 'sources-differ'] as const;
/** Statuses that are only acceptable with an independent, existence-verified second source. */
export const NEEDS_SECOND_SOURCE: ReadonlySet<string> = new Set(['not-found-in-reference', 'beyond-reference', 'sources-differ']);
export const ledgerSchema = z.object({
  /** entity or pattern id; must equal the file name. */
  entity: Id,
  claims: z.array(
    z
      .object({
        claimId: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
        section: z.string().min(1),
        statement: z.string().min(1), // our own wording, never quoted reference text
        sourceRef: SourceRef,
        status: z.enum(CLAIM_STATUSES),
        secondSource: z.object({ source: Id, locator: z.string().min(1) }).optional(),
        verifiedBy: z.enum(['agent', 'human']),
        verifier: z.string().min(1),
        date: z.coerce.date(),
      })
      .superRefine((c, ctx) => {
        if (NEEDS_SECOND_SOURCE.has(c.status) && !c.secondSource)
          ctx.addIssue({ code: 'custom', path: ['secondSource'], message: `secondSource is required for status ${c.status}` });
      }),
  ),
});
export type Ledger = z.infer<typeof ledgerSchema>;

// ── Structures — src/content/structures/<id>.yaml (written by scripts/fetch-structures.mjs) ──
/** PDB entries shown in the 3D pathway viewer (O9). Provenance comes from the RCSB Data API; PDB data are CC0. */
export const structureSchema = z
  .object({
    id: Id,
    pdb: z.string().regex(/^[0-9][A-Z0-9]{3}$/),
    title: z.string().min(1), // RCSB title, verbatim
    method: z.string().min(1),
    resolution: z.number().positive().optional(), // Å; absent for NMR
    organisms: z.array(z.string().min(1)).min(1),
    released: z.coerce.date(),
    components: z
      .array(
        z.object({
          name: z.string().min(1),
          organism: z.string().min(1),
          chains: z.array(z.string().min(1)).min(1),
          mutations: z.number().int().min(0),
          fragment: z.string().optional(),
        }),
      )
      .min(1),
    ligands: z.array(z.object({ id: z.string().min(1), name: z.string().min(1) })).default([]),
    citation: z
      .object({
        title: z.string().min(1),
        authors: z.string().min(1),
        journal: z.string().min(1),
        year: z.number().int(),
        doi: z.string().optional(),
        pmid: z.string().regex(/^\d+$/).optional(),
      })
      .refine((c) => c.doi || c.pmid, 'citation needs a DOI or a PMID'),
    /** Construct and organism notes (engineered, non-human, fragment, NMR model, CA-only), our own wording. */
    caveats: L,
    file: z.string().regex(/^structures\/[a-z0-9]+\.bcif\.gz$/),
    bytes: z.number().int().positive(),
    // The ModelServer `assembly` BinaryCIF output crashes the 3Dmol 2.5.5 parser.
    modelServerQuery: z.string().refine((q) => !q.startsWith('assembly'), 'never use the /assembly BinaryCIF output'),
    /** CA-only trace (very large complexes). */
    coarse: z.boolean(),
    /** Only these chains are drawn (e.g. one copy of a crystal's asymmetric unit). */
    show: z.array(z.string().min(1)).optional(),
    atomCount: z.number().int().positive(),
    hydrogenAtoms: z.number().int().min(0),
    extraAltLocAtoms: z.number().int().min(0),
    chains: z
      .array(
        z.object({
          id: z.string().min(1),
          atoms: z.number().int().positive(),
          residues: z.string().optional(),
          hetero: z.array(z.string()).optional(),
        }),
      )
      .min(1),
    license: z.literal('CC0-1.0'),
    sourceUrl: z.url(),
    retrievedAt: z.coerce.date(),
  })
  .superRefine((s, ctx) => {
    if (s.id !== s.pdb.toLowerCase()) ctx.addIssue({ code: 'custom', path: ['id'], message: 'id must be the lower-case PDB id' });
    const chains = new Set(s.chains.map((c) => c.id));
    for (const c of s.show ?? []) if (!chains.has(c)) ctx.addIssue({ code: 'custom', path: ['show'], message: `unknown chain "${c}"` });
  });
export type Structure = z.infer<typeof structureSchema>;

// ── Pathways — src/content/pathways/<id>.yaml; claims in docs/ledger/pathway-<id>.yaml ──
/** What the 3D view highlights for one step: chains, a residue range and/or residue names (ligands). */
export const highlightSchema = z
  .object({
    chains: z.array(z.string().min(1)).optional(),
    resi: z.string().regex(/^\d+(-\d+)?$/).optional(),
    resn: z.array(z.string().min(1)).optional(),
    label: L,
  })
  .refine((h) => h.chains || h.resi || h.resn, 'highlight needs chains, resi or resn');
export const pathwaySchema = z
  .object({
    id: Id,
    title: L,
    summary: L,
    /** Entity page that shows the compact block. */
    entity: Id,
    module: ModuleId,
    steps: z
      .array(
        z.object({
          id: Id,
          title: L,
          /** Label inside the 2D diagram box (a few words). */
          short: L,
          /** Our own wording, with claim markers <!--c:<claim-id>--> after each factual sentence. */
          text: L,
          /** Shown as <aside class="sources-differ"> under the step; needed for each `sources-differ` ledger row of the step. */
          sourcesDiffer: L.optional(),
          structure: Id.optional(),
          highlight: highlightSchema.optional(),
        }),
      )
      .min(2),
    sources: z.array(SourceRef).min(1),
    reviewStatus: ReviewStatus,
    reviewedBy: ReviewedBy.optional(),
    lastUpdated: z.coerce.date(),
    status: Status,
  })
  .superRefine((p, ctx) => {
    const ids = p.steps.map((s) => s.id);
    if (new Set(ids).size !== ids.length) ctx.addIssue({ code: 'custom', path: ['steps'], message: 'step ids must be unique' });
    p.steps.forEach((s, i) => {
      if (s.highlight && !s.structure)
        ctx.addIssue({ code: 'custom', path: ['steps', i, 'highlight'], message: 'highlight needs a structure' });
    });
    if (p.reviewStatus === 'expert-reviewed' && !p.reviewedBy)
      ctx.addIssue({ code: 'custom', path: ['reviewedBy'], message: 'reviewedBy is required for expert-reviewed' });
  });
export type Pathway = z.infer<typeof pathwaySchema>;
