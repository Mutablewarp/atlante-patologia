/**
 * Content schemas (CONTENT_SCHEMA.md). One definition, used by
 * src/content.config.ts and by Vitest validators.
 */
import { z } from 'astro/zod';

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
    reviewedBy: z.object({ name: z.string().min(1), date: z.coerce.date() }).optional(),
    editionDependent: z.boolean(),
    editionNote: L.optional(),
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
export const imageSchema = z
  .object({
    id: Id,
    file: z.string().min(1),
    kind: z.enum(['gross', 'micro', 'diagram', 'imaging', 'clinical']),
    sourceUrl: z.url(),
    author: z.string().min(1),
    license: z.enum(IMAGE_LICENSES),
    licenseUrl: z.url(),
    retrievedAt: z.coerce.date(),
    modifications: z.string().min(1),
    attributionText: z.string().min(1),
    patientIdentifiable: z.literal(false),
    ownerApproved: z.boolean().default(false),
    verifiedBy: z.object({ who: z.enum(['agent', 'human']), name: z.string().min(1), date: z.coerce.date() }),
    stain: z.string().optional(),
    magnification: z.string().optional(),
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
  })
  .superRefine((img, ctx) => {
    if (img.license.startsWith('CC-BY-SA') && !img.ownerApproved)
      ctx.addIssue({ code: 'custom', path: ['ownerApproved'], message: 'CC BY-SA images need ownerApproved: true' });
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

export const sourceSchema = z.object({
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
  existsVerified: z.object({ via: z.enum(['crossref', 'pubmed', 'publisher']), date: z.coerce.date() }),
});
export type Source = z.infer<typeof sourceSchema>;
