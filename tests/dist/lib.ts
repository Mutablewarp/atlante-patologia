/**
 * Helpers for the dist/ validators (NAVIGATION_SPEC §7, ARCHITECTURE §7).
 * They read the built site only; run them with `npm run test:dist` after
 * `npm run build`.
 *
 * shortcut: regex HTML extraction, fine for Astro's own quoted, well-formed
 * output; switch to a real parser if hand-written HTML ever lands in dist/.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

export const DIST = join(process.cwd(), 'dist');
export const BASE = '/atlante-patologia/';
export const SITE_ORIGIN = 'https://mutablewarp.github.io';
export const LANGS = ['it', 'en'] as const;

export function walk(dir: string = DIST): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

/** dist file → site path: dist/it/atlas/index.html → /atlante-patologia/it/atlas/ */
export function pageUrl(file: string): string {
  const rel = relative(DIST, file).split(sep).join('/');
  return BASE + rel.replace(/(^|\/)index\.html$/, '$1');
}

/** Site path (no query/hash) → dist file, or null when nothing is served there. */
export function resolveFile(pathname: string): string | null {
  if (!pathname.startsWith(BASE)) return null;
  const rel = decodeURIComponent(pathname.slice(BASE.length));
  const file = rel === '' || rel.endsWith('/') ? join(DIST, rel, 'index.html') : join(DIST, rel);
  return existsSync(file) && statSync(file).isFile() ? file : null;
}

export type Page = { file: string; url: string; html: string };

export function pages(): Page[] {
  return walk()
    .filter((f) => f.endsWith('.html'))
    .map((file) => ({ file, url: pageUrl(file), html: readFileSync(file, 'utf8') }))
    .sort((a, b) => a.url.localeCompare(b.url));
}

/** Remove regions marked data-nav="global" (top bar, primary nav, footer, notice). */
export function contentHtml(html: string): string {
  return html.replace(/<(header|nav|footer|section|div|aside)\b[^>]*\bdata-nav="global"[^>]*>[\s\S]*?<\/\1>/g, '');
}

export function attrValues(html: string, attr: 'href' | 'src' | 'action'): string[] {
  const re = new RegExp(`\\s${attr}="([^"]*)"`, 'g');
  return [...html.matchAll(re)].map((m) => decodeEntities(m[1]!));
}

/** <a href> values only (navigation links, not <link> or <base>). */
export function anchorHrefs(html: string): string[] {
  return [...html.matchAll(/<a\b[^>]*?\shref="([^"]*)"/g)].map((m) => decodeEntities(m[1]!));
}

export function ids(html: string): Set<string> {
  return new Set([...html.matchAll(/\s(?:id|name)="([^"]+)"/g)].map((m) => decodeEntities(m[1]!)));
}

function decodeEntities(s: string): string {
  return s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

/** Resolve an href against a page URL; null for other origins and non-http schemes. */
export function internalUrl(href: string, from: string): URL | null {
  if (/^(mailto|tel|javascript|data):/i.test(href)) return null;
  const u = new URL(href, SITE_ORIGIN + from);
  return u.origin === SITE_ORIGIN ? u : null;
}

export const isEntity = (url: string) => /^\/atlante-patologia\/(it|en)\/e\/[^/]+\/$/.test(url);
/** Lens index or lens term page; the A–Z index is not a lens (CONTENT_SCHEMA §3.2). */
export const isLens = (url: string) => /^\/atlante-patologia\/(it|en)\/atlas\/(?!az\/)[^/]+\//.test(url);

/** Content-link graph: page → set of linked pages (self-links dropped). */
export function contentGraph(all: Page[]): Map<string, Set<string>> {
  const graph = new Map<string, Set<string>>();
  for (const p of all) {
    const out = new Set<string>();
    for (const href of anchorHrefs(contentHtml(p.html))) {
      const u = internalUrl(href, p.url);
      if (!u || !resolveFile(u.pathname)?.endsWith('.html')) continue;
      if (u.pathname !== p.url) out.add(u.pathname);
    }
    graph.set(p.url, out);
  }
  return graph;
}

/** BFS hop distances from one page. */
export function distances(graph: Map<string, Set<string>>, from: string): Map<string, number> {
  const dist = new Map([[from, 0]]);
  const queue = [from];
  while (queue.length) {
    const cur = queue.shift()!;
    for (const next of graph.get(cur) ?? []) {
      if (dist.has(next)) continue;
      dist.set(next, dist.get(cur)! + 1);
      queue.push(next);
    }
  }
  return dist;
}

/** Fewest steps from `from` to every page along a path that visits a lens page. */
export function lensDistances(graph: Map<string, Set<string>>, from: string): Map<string, number> {
  // State = (page, has the path passed through a lens page yet?)
  const seen = new Map<string, number>();
  const key = (u: string, lens: boolean) => `${lens ? 1 : 0}${u}`;
  const queue: [string, boolean, number][] = [[from, isLens(from), 0]];
  seen.set(key(from, isLens(from)), 0);
  const result = new Map<string, number>();
  while (queue.length) {
    const [cur, lens, d] = queue.shift()!;
    if (lens && !result.has(cur)) result.set(cur, d);
    for (const next of graph.get(cur) ?? []) {
      const nextLens = lens || isLens(next);
      if (seen.has(key(next, nextLens))) continue;
      seen.set(key(next, nextLens), d + 1);
      queue.push([next, nextLens, d + 1]);
    }
  }
  return result;
}
