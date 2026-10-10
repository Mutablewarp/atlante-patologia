/**
 * Build-time helpers shared by the horizontal-layer pages (patterns, compare,
 * map, paths) and the entity page: cross-link context, glossary anchors,
 * images, pattern membership.
 */
import { getCollection } from 'astro:content';
import type { Lang } from '../i18n/index.ts';
import { tHz } from '../i18n/horizontal.ts';
import { langPath } from './url.ts';
import { siteData, glossary, images, patterns } from './content.ts';
import { resolveCrossLinks, type CrossLinkCtx } from './crosslinks.ts';

/** A–Z anchor of a glossary term; entities own `term-<id>`, so a clash gets `term-g-<id>`. */
export function glossaryAnchor(id: string, entityIds: { has(id: string): boolean }): string {
  return entityIds.has(id) ? `term-g-${id}` : `term-${id}`;
}

let names: Promise<Map<string, { it: string; en: string }>> | undefined;
/** Names of every known entity: all entity files (drafts too) and planned entries in modules.yaml. */
function allNames() {
  names ??= (async () => {
    const out = new Map<string, { it: string; en: string }>();
    const { modules } = await siteData();
    for (const m of modules) for (const p of m.planned) out.set(p.id, p.names);
    for (const e of await getCollection('entities')) out.set(e.data.id, { it: e.data.names.it, en: e.data.names.en });
    return out;
  })();
  return names;
}

export async function crossLinkContext(lang: Lang, idPrefix = 'gloss'): Promise<CrossLinkCtx> {
  const { entityById } = await siteData();
  const known = await allNames();
  const gloss = new Map((await glossary()).map((g) => [g.id, g]));
  return {
    lang,
    idPrefix,
    entityUrl: (id) => (entityById.has(id) ? langPath(lang, `e/${id}/`) : undefined),
    entityName: (id) => known.get(id)?.[lang],
    glossary: gloss,
    glossaryUrl: (id) => `${langPath(lang, 'atlas/az/')}#${glossaryAnchor(id, entityById)}`,
    strings: { planned: tHz(lang, 'planned'), glossary: tHz(lang, 'glossary'), az: tHz(lang, 'seeAz') },
  };
}

/** Resolve `[[…]]` cross-links in rendered Markdown HTML. */
export async function withCrossLinks(html: string, lang: Lang, idPrefix?: string): Promise<string> {
  return resolveCrossLinks(html, await crossLinkContext(lang, idPrefix));
}

/** Known entity name in `lang` (visible, draft or planned), else the humanized id. */
export async function anyEntityName(id: string, lang: Lang): Promise<string> {
  return (await allNames()).get(id)?.[lang] ?? id.replace(/-/g, ' ');
}

export async function imageById() {
  return new Map((await images()).map((i) => [i.id, i]));
}

/** Pattern pages whose matrix lists the entity. */
export async function patternsForEntity(id: string) {
  return (await patterns()).filter((p) => p.matrix.rows.some((r) => r.entity === id));
}

/** Entity section where an image of this role is shown. */
export const SECTION_FOR_ROLE = {
  gross: 'gross',
  micro: 'micro',
  diagram: 'pathogenesis',
  imaging: 'diagnosis',
  clinical: 'clinical',
} as const;
