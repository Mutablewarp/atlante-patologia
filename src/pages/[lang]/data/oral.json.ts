/** Possible exam questions of every visible entity, for the oral exam simulator. */
import type { APIRoute } from 'astro';
import { langPaths, type Lang } from '../../../i18n/index.ts';
import { oralQuestions } from '../../../lib/study.ts';

export const getStaticPaths = langPaths;

export const GET: APIRoute = async ({ params }) =>
  new Response(JSON.stringify(await oralQuestions(params.lang as Lang)), { headers: { 'Content-Type': 'application/json' } });
