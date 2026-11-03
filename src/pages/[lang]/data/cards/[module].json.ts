/** Flashcards of one module in one language (CONTENT_SCHEMA §7). */
import type { APIRoute } from 'astro';
import { LANGS, type Lang } from '../../../../i18n/index.ts';
import { allCards } from '../../../../lib/study.ts';

export async function getStaticPaths() {
  const modules = [...(await allCards()).keys()];
  return modules.flatMap((module) => LANGS.map((lang) => ({ params: { lang, module } })));
}

export const GET: APIRoute = async ({ params }) => {
  const cards = (await allCards()).get(params.module!)?.[params.lang as Lang] ?? [];
  return new Response(JSON.stringify(cards), { headers: { 'Content-Type': 'application/json' } });
};
