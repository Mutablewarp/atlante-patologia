/**
 * Quick-mode text of every entity (the sections marked `quick`, with the
 * definition cut to its first block, as in Quick reading mode), for Compare.
 */
import type { APIRoute } from 'astro';
import { LANGS, type Lang } from '../../../i18n/index.ts';
import { SECTIONS } from '../../../i18n/sections.ts';
import { siteData, entityBody } from '../../../lib/content.ts';
import { splitSections } from '../../../lib/sections.ts';
import { withCrossLinks } from '../../../lib/horizontal.ts';

export const getStaticPaths = () => LANGS.map((lang) => ({ params: { lang } }));

const firstBlock = (html: string) => html.replace(/<!--[\s\S]*?-->/g, '').match(/^\s*(<(\w+)[\s\S]*?<\/\2>)/)?.[1] ?? html;

export const GET: APIRoute = async ({ params }) => {
  const lang = params.lang as Lang;
  const { entities } = await siteData(lang);
  const quick = SECTIONS.filter((s) => s.quick);
  const out: Record<string, Record<string, string>> = {};
  for (const e of entities) {
    const body = await entityBody(e.id, lang);
    const html = await withCrossLinks(body?.rendered?.html ?? '', lang, `cmp-${e.id}`);
    const { sections } = splitSections(html);
    out[e.id] = Object.fromEntries(
      quick.map((s) => {
        const h = sections.get(s.id) ?? '';
        return [s.id, s.id === 'definition' ? firstBlock(h) : h];
      }),
    );
  }
  return new Response(JSON.stringify(out), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
};
