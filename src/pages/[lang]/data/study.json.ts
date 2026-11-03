/** Compact study index: modules and entities with their card ids (used by every study island). */
import type { APIRoute } from 'astro';
import { langPaths, type Lang } from '../../../i18n/index.ts';
import { studyIndex } from '../../../lib/study.ts';

export const getStaticPaths = langPaths;

export const GET: APIRoute = async ({ params }) =>
  new Response(JSON.stringify(await studyIndex(params.lang as Lang)), { headers: { 'Content-Type': 'application/json' } });
