/**
 * Build-time content access. Only `status: published` content is visible,
 * unless the build runs with PREVIEW_DRAFTS=1 (local template checks).
 */
import { getCollection, type CollectionEntry } from 'astro:content';
import type { LensId } from './schema.ts';
import { lensMembership, syllabusSort } from './lenses.ts';
import { buildRelationIndex } from './relations.ts';

export const PREVIEW_DRAFTS = process.env.PREVIEW_DRAFTS === '1';

const visible = (status: 'draft' | 'published') => status === 'published' || PREVIEW_DRAFTS;

export type EntityEntry = CollectionEntry<'entities'>;
export type ModuleEntry = CollectionEntry<'modules'>;
export type TaxonomyEntry = CollectionEntry<'taxonomy'>;

let cache: Promise<SiteData> | undefined;

export type SiteData = {
  modules: ModuleEntry['data'][];
  moduleOrder: Map<string, number>;
  taxonomy: Map<LensId, TaxonomyEntry['data']>;
  entities: EntityEntry['data'][];
  entityById: Map<string, EntityEntry['data']>;
  membership: ReturnType<typeof lensMembership>;
  relations: ReturnType<typeof buildRelationIndex>;
};

async function load(): Promise<SiteData> {
  const modules = (await getCollection('modules')).map((m) => m.data).sort((a, b) => a.order - b.order);
  const moduleOrder = new Map(modules.map((m) => [m.id, m.order]));
  const taxonomy = new Map((await getCollection('taxonomy')).map((t) => [t.data.lens, t.data] as const));
  const entities = syllabusSort(
    (await getCollection('entities', (e) => visible(e.data.status))).map((e) => e.data),
    moduleOrder,
  );
  return {
    modules,
    moduleOrder,
    taxonomy,
    entities,
    entityById: new Map(entities.map((e) => [e.id, e])),
    membership: lensMembership(entities, moduleOrder),
    relations: buildRelationIndex(entities),
  };
}

/** Cached for the whole build. */
export function siteData(): Promise<SiteData> {
  cache ??= load();
  return cache;
}

export async function entityBody(id: string, lang: 'it' | 'en') {
  const bodies = await getCollection('entityBodies');
  return bodies.find((b) => b.id === `${id}/${lang}`);
}

export async function sources() {
  return (await getCollection('sources')).map((s) => s.data);
}

export async function images() {
  return (await getCollection('images')).map((i) => i.data);
}
