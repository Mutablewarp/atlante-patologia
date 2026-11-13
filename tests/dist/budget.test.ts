/**
 * Size budgets (ARCHITECTURE §8): total dist/ < 400 MB (V3 plan decision D8: raised from
 * 300 MB with the image diet; the images of one card: tests/dist/image-weight.test.ts); JavaScript loaded by a
 * page (inline scripts + module scripts + everything they import, gzipped) is
 * ≤ 50 KB on content pages and ≤ 120 KB on study pages.
 * Static imports always count. Dynamic imports count too (the shell script
 * loads the personal layer at once on the hub, Me and path pages), except the
 * chunks only a learner's action imports (command palette, 3D view; the
 * Pagefind bundle is imported by a computed URL and never followed) and the
 * conditional ones whose condition the page does not meet.
 * Astro islands count: their component, renderer and before-hydration modules
 * are fetched on hydration (client:load / idle / visible).
 */
import { readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { BASE, internalUrl, pages, resolveFile, walk, type Page } from './lib.ts';

const MB = 1024 * 1024;
const KB = 1024;
const TOTAL_MAX = 400 * MB;
const CONTENT_JS_MAX = 50 * KB;
const STUDY_JS_MAX = 120 * KB;
const isStudy = (url: string) => /^\/atlante-patologia\/(it|en)\/study\//.test(url);

/** Imported only after a learner's action: the command palette (⌘/Ctrl K) and the 3D view button. */
const ON_DEMAND = /\/(?:palette|structure-3d)\.[\w-]+\.js$/;
/** Imported at once, but only when the page meets the condition (read from the built HTML). */
const WHEN: [chunk: RegExp, html: RegExp][] = [
  // BaseLayout.astro: the personal layer, for its custom elements.
  [/\/personal\.[\w-]+\.js$/, /<ap-(?:recent|resume|path-progress|due-count|export-reminder)\b/],
  // @astrojs/preact client: islands with signal props.
  [/\/signals\.module\.[\w-]+\.js$/, /\sdata-preact-signals=/],
];

/** Import graph of one JS file as loaded on `html` (minified ESM: `from"./x.js"`, `import"./x.js"`, import(`./x.js`)). */
function graph(file: string, html: string, seen = new Set<string>()): Set<string> {
  if (seen.has(file)) return seen;
  seen.add(file);
  const text = readFileSync(file, 'utf8');
  for (const m of text.matchAll(/(?:\bfrom|\bimport)\s*["'](\.{1,2}\/[^"']+\.m?js)["']/g)) graph(join(dirname(file), m[1]!), html, seen);
  for (const m of text.matchAll(/\bimport\(\s*["'`](\.{1,2}\/[^"'`]+\.m?js)["'`]\s*\)/g)) {
    const target = join(dirname(file), m[1]!);
    if (ON_DEMAND.test(target)) continue;
    const rule = WHEN.find(([chunk]) => chunk.test(target));
    if (!rule || rule[1].test(html)) graph(target, html, seen);
  }
  return seen;
}

const gz = (s: string | Buffer) => gzipSync(s).length;
// Shared chunks are counted on many pages: gzip each file once.
const gzCache = new Map<string, number>();
const gzFile = (f: string) => gzCache.get(f) ?? gzCache.set(f, gz(readFileSync(f))).get(f)!;

/** The JavaScript a page loads without any action of the learner: files and gzipped bytes. */
function pageJs(p: Page) {
  const inline = [...p.html.matchAll(/<script\b(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]!).join('\n');
  const files = new Set<string>();
  const refs = [
    ...p.html.matchAll(/<script\b[^>]*\ssrc="([^"]+)"/g),
    ...p.html.matchAll(/<link\b[^>]*rel="modulepreload"[^>]*href="([^"]+)"/g),
    // Attributes of <astro-island> only (each island has several).
    ...p.html.matchAll(/\s(?:component|renderer|before-hydration)-url="([^"]+)"/g),
  ].map((m) => m[1]!);
  for (const ref of refs) {
    const u = internalUrl(ref, p.url);
    const f = u && resolveFile(u.pathname);
    if (f) graph(f, p.html).forEach((x) => files.add(x));
  }
  return { files, bytes: gz(inline) + [...files].reduce((n, f) => n + gzFile(f), 0) };
}

describe('size budget', () => {
  const all = pages();

  it(`dist/ is smaller than ${TOTAL_MAX / MB} MB`, () => {
    const total = walk().reduce((n, f) => n + statSync(f).size, 0);
    console.info(`dist/ total: ${(total / MB).toFixed(2)} MB`);
    expect(total).toBeLessThan(TOTAL_MAX);
  });

  it('JavaScript per page stays within budget (gzipped)', () => {
    const over: string[] = [];
    let heaviest = { url: '', bytes: 0 };
    for (const p of all) {
      const { bytes } = pageJs(p);
      const max = isStudy(p.url) ? STUDY_JS_MAX : CONTENT_JS_MAX;
      if (bytes > max) over.push(`${p.url}: ${(bytes / KB).toFixed(1)} KB gz > ${max / KB} KB`);
      if (bytes > heaviest.bytes) heaviest = { url: p.url, bytes };
    }
    console.info(`heaviest page JS: ${heaviest.url.replace(BASE, '/')} ${(heaviest.bytes / KB).toFixed(1)} KB gz`);
    expect(over).toEqual([]);
  });

  it('counts the personal layer where the shell script imports it at load, and never the palette or the 3D view', () => {
    const at = (url: string) => {
      const p = all.find((x) => x.url === `${BASE}${url}`);
      if (!p) throw new Error(`${url} not built`);
      return [...pageJs(p).files].map((f) => f.split('/').pop()!.replace(/\.[\w-]+\.js$/, ''));
    };
    // The study hub shows the due count and the resume card: personal.ts, the database and the study index load at once.
    expect(at('it/study/')).toEqual(expect.arrayContaining(['personal', 'db', 'study']));
    expect(at('it/about/')).not.toContain('personal');
    for (const url of ['it/study/', 'it/e/apoptosis/', 'it/pathways/intrinsic-apoptosis/']) {
      expect(at(url)).not.toContain('palette');
      expect(at(url)).not.toContain('structure-3d');
    }
  });
});
