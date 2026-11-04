/**
 * Size budgets (ARCHITECTURE §8): total dist/ < 300 MB; JavaScript loaded by a
 * page (inline scripts + module scripts + their static imports, gzipped) is
 * ≤ 50 KB on content pages and ≤ 120 KB on study pages. Dynamic imports
 * (the Pagefind bundle on the search page) load on demand and are not counted.
 * Astro islands count: their component, renderer and before-hydration modules
 * are fetched on hydration (client:load / idle / visible).
 */
import { readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { BASE, internalUrl, pages, resolveFile, walk } from './lib.ts';

const MB = 1024 * 1024;
const KB = 1024;
const TOTAL_MAX = 300 * MB;
const CONTENT_JS_MAX = 50 * KB;
const STUDY_JS_MAX = 120 * KB;
const isStudy = (url: string) => /^\/atlante-patologia\/(it|en)\/study\//.test(url);

/** Static import graph of one JS file (minified ESM: `from"./x.js"`, `import"./x.js"`). */
function staticGraph(file: string, seen = new Set<string>()): Set<string> {
  if (seen.has(file)) return seen;
  seen.add(file);
  const text = readFileSync(file, 'utf8');
  for (const m of text.matchAll(/(?:\bfrom|\bimport)\s*["'](\.{1,2}\/[^"']+\.m?js)["']/g)) staticGraph(join(dirname(file), m[1]!), seen);
  return seen;
}

const gz = (s: string | Buffer) => gzipSync(s).length;
// Shared chunks are counted on many pages: gzip each file once.
const gzCache = new Map<string, number>();
const gzFile = (f: string) => gzCache.get(f) ?? gzCache.set(f, gz(readFileSync(f))).get(f)!;

describe('size budget', () => {
  it(`dist/ is smaller than ${TOTAL_MAX / MB} MB`, () => {
    const total = walk().reduce((n, f) => n + statSync(f).size, 0);
    console.info(`dist/ total: ${(total / MB).toFixed(2)} MB`);
    expect(total).toBeLessThan(TOTAL_MAX);
  });

  it('JavaScript per page stays within budget (gzipped)', () => {
    const over: string[] = [];
    let heaviest = { url: '', bytes: 0 };
    for (const p of pages()) {
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
        if (f) staticGraph(f).forEach((x) => files.add(x));
      }
      const bytes = gz(inline) + [...files].reduce((n, f) => n + gzFile(f), 0);
      const max = isStudy(p.url) ? STUDY_JS_MAX : CONTENT_JS_MAX;
      if (bytes > max) over.push(`${p.url}: ${(bytes / KB).toFixed(1)} KB gz > ${max / KB} KB`);
      if (bytes > heaviest.bytes) heaviest = { url: p.url, bytes };
    }
    console.info(`heaviest page JS: ${heaviest.url.replace(BASE, '/')} ${(heaviest.bytes / KB).toFixed(1)} KB gz`);
    expect(over).toEqual([]);
  });
});
