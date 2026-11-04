/**
 * One sample URL per page template, discovered from dist/ so new templates
 * (entity pages, lens terms) are covered as soon as they are built.
 * Paths are relative to the baseURL (/atlante-patologia/).
 */
import { readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const DIST = join(process.cwd(), 'dist');

function htmlPages(dir = DIST): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return htmlPages(p);
    return p.endsWith('index.html') ? [relative(DIST, p).split(sep).join('/').replace(/index\.html$/, '')] : [];
  });
}

const built = htmlPages().sort();
const first = (re: RegExp) => built.find((p) => re.test(p));

/** Template name → sample path. Optional templates appear once content exists. */
export const TEMPLATES: Record<string, string> = Object.fromEntries(
  Object.entries({
    'home-it': 'it/',
    'home-en': 'en/',
    atlas: 'it/atlas/',
    lens: 'it/atlas/system/',
    'lens-term': first(/^it\/atlas\/(?!az\/)[^/]+\/[^/]+\/$/),
    az: 'en/atlas/az/',
    entity: first(/^it\/e\/[^/]+\/$/),
    pathway: first(/^it\/pathways\/[^/]+\/$/),
    study: 'it/study/',
    'study-oral': 'en/study/oral/',
    search: 'it/search/?q=atlante',
    me: 'en/me/',
    'about-index': 'it/about/',
    'about-page': 'it/about/reading-list/',
    roadmap: 'en/about/roadmap/',
    'not-found': 'it/pagina-inesistente/',
  }).filter((e): e is [string, string] => typeof e[1] === 'string'),
);

/** A few representative pages for the cheaper cross-engine checks. */
export const SAMPLE = ['it/', 'en/atlas/', 'it/atlas/system/', 'it/search/?q=atlante', 'en/about/privacy/'];
