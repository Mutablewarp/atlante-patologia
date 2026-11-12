/**
 * Static index for client tools (compare, command palette…), one per language:
 * entities (all names, summary, lens tags, module, tier, relations, images),
 * pattern pages, glossary terms, lens labels and the main pages.
 */
import type { APIRoute } from 'astro';
import { LANGS, type Lang } from '../../../i18n/index.ts';
import { siteData, patterns, glossary } from '../../../lib/content.ts';
import { glossaryAnchor } from '../../../lib/horizontal.ts';
import { sitePages } from '../../../lib/pages-index.ts';
import { langPath } from '../../../lib/url.ts';

export const getStaticPaths = () => LANGS.map((lang) => ({ params: { lang } }));

export const GET: APIRoute = async ({ params }) => {
  const lang = params.lang as Lang;
  const data = await siteData(lang);
  const body = {
    lang,
    entities: data.entities.map((e) => ({
      id: e.id,
      url: langPath(lang, `e/${e.id}/`),
      names: e.names,
      summary: e.summary[lang],
      module: e.module,
      tier: e.tier,
      lenses: e.lenses,
      relations: e.relations.map(({ type, target }) => ({ type, target })),
      images: e.images.map((i) => i.id),
    })),
    patterns: (await patterns()).map((p) => ({
      id: p.id,
      url: langPath(lang, `pattern/${p.id}/`),
      name: p.names[lang],
      altName: p.names[lang === 'it' ? 'en' : 'it'],
      summary: p.summary[lang],
      entities: p.matrix.rows.map((r) => r.entity),
    })),
    glossary: (await glossary()).map((g) => ({
      id: g.id,
      url: `${langPath(lang, 'atlas/az/')}#${glossaryAnchor(g.id, data.entityById)}`,
      term: g.term[lang],
      altTerm: g.term[lang === 'it' ? 'en' : 'it'],
      aliases: [...g.aliases.it, ...g.aliases.en],
      definition: g.definition[lang],
    })),
    lenses: Object.fromEntries(
      [...data.taxonomy].map(([lens, tax]) => [
        lens,
        { label: tax.label[lang], terms: Object.fromEntries(tax.terms.map((t) => [t.id, t.label[lang]])) },
      ]),
    ),
    pages: sitePages(lang),
  };
  return new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
};
