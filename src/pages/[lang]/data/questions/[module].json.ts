/** Quiz questions of one module in one language (CONTENT_SCHEMA §4). */
import type { APIRoute } from 'astro';
import { LANGS, type Lang } from '../../../../i18n/index.ts';
import { questions, questionsFor } from '../../../../lib/study.ts';

export async function getStaticPaths() {
  const modules = [...new Set((await questions()).map((q) => q.module))];
  return modules.flatMap((module) => LANGS.map((lang) => ({ params: { lang, module } })));
}

export const GET: APIRoute = async ({ params }) =>
  new Response(JSON.stringify(await questionsFor(params.module!, params.lang as Lang)), {
    headers: { 'Content-Type': 'application/json' },
  });
