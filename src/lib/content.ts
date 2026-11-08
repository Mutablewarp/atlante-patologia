/**
 * Build-time content access. Only `status: published` content is visible,
 * unless the build runs with PREVIEW_DRAFTS=1 (local template checks).
 */
import { getCollection, type CollectionEntry } from 'astro:content';
import type { Lang } from '../i18n/index.ts';
import type { LensId } from './schema.ts';
import { lensMembership, syllabusSort } from './lenses.ts';
import { buildRelationIndex } from './relations.ts';

export const PREVIEW_DRAFTS = process.env.PREVIEW_DRAFTS === '1';

const visible = (status: 'draft' | 'published') => status === 'published' || PREVIEW_DRAFTS;
/** Collections without `status` (glossary, paths, images): `_`-prefixed files are fixtures. */
const notFixture = (e: { filePath?: string }) => PREVIEW_DRAFTS || !/(^|\/)_/.test(e.filePath?.split('/content/')[1] ?? '');

export type EntityEntry = CollectionEntry<'entities'>;
export type ModuleEntry = CollectionEntry<'modules'>;
export type TaxonomyEntry = CollectionEntry<'taxonomy'>;

const cache = new Map<Lang, Promise<SiteData>>();

type Entity = EntityEntry['data'];

export type SiteData = {
  modules: ModuleEntry['data'][];
  moduleOrder: Map<string, number>;
  taxonomy: Map<LensId, TaxonomyEntry['data']>;
  /** Syllabus order in the page language (lenses.ts), as are the lens lists in `membership`. */
  entities: Entity[];
  entityById: Map<string, Entity>;
  membership: ReturnType<typeof lensMembership>;
  relations: ReturnType<typeof buildRelationIndex>;
};

async function load(lang: Lang): Promise<SiteData> {
  const modules = (await getCollection('modules')).map((m) => m.data).sort((a, b) => a.order - b.order);
  const moduleOrder = new Map(modules.map((m) => [m.id, m.order]));
  const taxonomy = new Map((await getCollection('taxonomy')).map((t) => [t.data.lens, t.data] as const));
  const entities = syllabusSort(
    (await getCollection('entities', (e) => visible(e.data.status))).map((e) => e.data),
    moduleOrder,
    lang,
  );
  return {
    modules,
    moduleOrder,
    taxonomy,
    entities,
    entityById: new Map(entities.map((e) => [e.id, e])),
    membership: lensMembership(entities, moduleOrder, lang),
    relations: buildRelationIndex(entities),
  };
}

/** Cached for the whole build, once per page language: every list of cards comes in that language's order. */
export function siteData(lang: Lang): Promise<SiteData> {
  if (!cache.has(lang)) cache.set(lang, load(lang));
  return cache.get(lang)!;
}

export async function entityBody(id: string, lang: 'it' | 'en') {
  const bodies = await getCollection('entityBodies');
  return bodies.find((b) => b.id === `${id}/${lang}`);
}

export async function sources() {
  return (await getCollection('sources')).map((s) => s.data);
}

export async function images() {
  return (await getCollection('images', (i) => notFixture(i) && visible(i.data.status))).map((i) => i.data);
}

export async function patterns() {
  return (await getCollection('patterns', (p) => visible(p.data.status))).map((p) => p.data);
}

export async function patternBody(id: string, lang: 'it' | 'en') {
  const bodies = await getCollection('patternBodies');
  return bodies.find((b) => b.id === `${id}/${lang}`);
}

export async function glossary() {
  return (await getCollection('glossary', notFixture)).map((g) => g.data);
}

export async function paths() {
  return (await getCollection('paths', notFixture)).map((p) => p.data);
}
