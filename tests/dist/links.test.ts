/**
 * Links and assets in dist/ (NAVIGATION_SPEC §7, ARCHITECTURE §7):
 * every internal href/src/action resolves, every #fragment exists, nothing
 * root-relative skips the /atlante-patologia/ base, and no asset is loaded
 * from another origin (outbound <a> links to citations and GitHub are fine).
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { LensData } from '../../src/lib/lens-context.ts';
import { BASE, SITE_ORIGIN, anchorHrefs, attrValues, ids, internalUrl, isEntity, pages, resolveFile, walk } from './lib.ts';

const all = pages();
const idCache = new Map<string, Set<string>>();
const idsOf = (file: string) => idCache.get(file) ?? idCache.set(file, ids(readFileSync(file, 'utf8'))).get(file)!;

describe('links and anchors', () => {
  it('every internal href, src and form action resolves to a file in dist/', () => {
    const broken: string[] = [];
    for (const p of all) {
      for (const attr of ['href', 'src', 'action'] as const) {
        for (const v of attrValues(p.html, attr)) {
          const u = internalUrl(v, p.url);
          if (!u || u.pathname === p.url) continue;
          if (!resolveFile(u.pathname)) broken.push(`${p.url}: ${attr}="${v}"`);
        }
      }
    }
    expect(broken).toEqual([]);
  });

  it('every #fragment exists on its target page', () => {
    const missing: string[] = [];
    for (const p of all) {
      for (const href of anchorHrefs(p.html)) {
        const u = internalUrl(href, p.url);
        if (!u || !u.hash || u.hash === '#') continue;
        const file = resolveFile(u.pathname);
        if (!file?.endsWith('.html')) continue; // reported by the test above
        const id = decodeURIComponent(u.hash.slice(1));
        if (!idsOf(file).has(id)) missing.push(`${p.url}: ${href}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('no root-relative URL misses the base path', () => {
    const bad: string[] = [];
    for (const p of all) {
      for (const attr of ['href', 'src', 'action'] as const) {
        for (const v of attrValues(p.html, attr)) {
          if (v.startsWith('/') && !v.startsWith('//') && !v.startsWith(BASE)) bad.push(`${p.url}: ${attr}="${v}"`);
        }
      }
    }
    expect(bad).toEqual([]);
  });

  // The lens contexts of a card are JSON, not links (src/lib/lens-context.ts): check here that what they point at exists.
  it('every lens context of an entity page leads to a lens term page and to cards that exist', () => {
    const broken: string[] = [];
    const entities = all.filter((p) => isEntity(p.url));
    expect(entities.length).toBeGreaterThan(0);
    for (const p of entities) {
      const json = p.html.match(/<script type="application\/json" id="lens-contexts">([\s\S]*?)<\/script>/)?.[1];
      if (!json) {
        broken.push(`${p.url}: no lens-contexts JSON`);
        continue;
      }
      const { base, c } = JSON.parse(json) as LensData;
      for (const [via, [, , prev, next]] of Object.entries(c)) {
        const [lens, term] = via.split(':');
        const to = [`atlas/${lens}/${term}/`, ...[prev, next].flatMap((n) => (n ? [`e/${n[0]}/`] : []))];
        for (const path of to) if (!resolveFile(base + path)) broken.push(`${p.url} ${via}: ${base + path}`);
      }
    }
    expect(broken).toEqual([]);
  });
});

describe('no external assets', () => {
  const external = (v: string) => /^(https?:)?\/\//i.test(v) && !v.startsWith(SITE_ORIGIN);

  it('HTML loads scripts, styles, images, fonts and frames from the site only', () => {
    const bad: string[] = [];
    for (const p of all) {
      // Everything with src= (script, img, iframe, source, video, audio).
      for (const v of attrValues(p.html, 'src')) if (external(v)) bad.push(`${p.url}: src="${v}"`);
      for (const m of p.html.matchAll(/\ssrcset="([^"]*)"/g))
        for (const v of m[1]!.split(',').map((s) => s.trim().split(/\s+/)[0]!))
          if (external(v)) bad.push(`${p.url}: srcset ${v}`);
      // <link> is an asset unless it is metadata about this page (canonical, alternate, sitemap).
      for (const m of p.html.matchAll(/<link\b[^>]*>/g)) {
        const rel = /\srel="([^"]*)"/.exec(m[0])?.[1] ?? '';
        const href = /\shref="([^"]*)"/.exec(m[0])?.[1] ?? '';
        if (!/^(canonical|alternate|sitemap)$/.test(rel) && external(href)) bad.push(`${p.url}: <link rel="${rel}" href="${href}">`);
      }
      for (const v of cssUrls(p.html)) if (external(v)) bad.push(`${p.url}: url(${v})`);
    }
    expect(bad).toEqual([]);
  });

  it('CSS, JS and the web manifest reference no other origin', () => {
    const bad: string[] = [];
    for (const f of walk().filter((x) => /\.(css|js|mjs|webmanifest)$/.test(x))) {
      const text = readFileSync(f, 'utf8');
      for (const v of cssUrls(text)) if (external(v)) bad.push(`${f}: url(${v})`);
      // Static and dynamic imports, fetch() and importScripts() of absolute URLs.
      for (const m of text.matchAll(/(?:\bimport\s*\(?|\bfrom|\bfetch\s*\(|importScripts\s*\()\s*["'`]((?:https?:)?\/\/[^"'`]+)/g))
        if (external(m[1]!)) bad.push(`${f}: ${m[1]}`);
      if (f.endsWith('.webmanifest'))
        for (const m of text.matchAll(/"src"\s*:\s*"([^"]+)"/g)) if (external(m[1]!)) bad.push(`${f}: ${m[1]}`);
    }
    expect(bad).toEqual([]);
  });
});

function cssUrls(text: string): string[] {
  return [...text.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)].map((m) => m[1]!.trim());
}
