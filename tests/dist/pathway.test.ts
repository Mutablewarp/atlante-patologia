/**
 * 3D pathways on the built site: the 3Dmol chunk exists, is loaded only by a
 * dynamic import (never in a page's static graph) and stays out of the
 * service-worker precache, like the structure files. Reports gzipped sizes.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { LAZY_ONLY } from '../../scripts/sw-manifest.mjs';
import { DIST, resolveFile } from './lib.ts';

const KB = 1024;
const gz = (f: string) => gzipSync(readFileSync(f)).length;
const astro = readdirSync(join(DIST, '_astro')).filter((f) => f.endsWith('.js'));
const threeDmol = astro.filter((f) => readFileSync(join(DIST, '_astro', f), 'utf8').includes('viewer_3Dmoljs'));
const precache = Object.keys(JSON.parse(readFileSync(join(DIST, 'precache.json'), 'utf8')).files as Record<string, string>);

/** Module scripts of a page plus their static imports (as in budget.test.ts). */
function staticJs(page: string): string[] {
  const html = readFileSync(resolveFile(page)!, 'utf8');
  const seen = new Set<string>();
  const visit = (file: string) => {
    if (seen.has(file)) return;
    seen.add(file);
    for (const m of readFileSync(file, 'utf8').matchAll(/(?:\bfrom|\bimport)\s*["'](\.{1,2}\/[^"']+\.m?js)["']/g)) visit(join(dirname(file), m[1]!));
  };
  for (const m of html.matchAll(/<script\b[^>]*\ssrc="([^"]+)"/g)) visit(resolveFile(m[1]!)!);
  return [...seen];
}

describe('3D pathway assets', () => {
  it('3Dmol lives in exactly one lazy chunk whose name matches the sw-manifest rule', () => {
    expect(threeDmol).toHaveLength(1);
    expect(LAZY_ONLY.test(`_astro/${threeDmol[0]}`)).toBe(true);
    console.info(`3Dmol chunk ${threeDmol[0]}: ${(gz(join(DIST, '_astro', threeDmol[0]!)) / KB).toFixed(1)} KB gz`);
  });

  it('precache.json holds neither the 3Dmol chunk nor any structure file', () => {
    expect(precache.filter((p) => LAZY_ONLY.test(p) || p.startsWith('structures/'))).toEqual([]);
    expect(precache.some((p) => p.includes('Pathway.astro'))).toBe(true); // the small element code is shell
  });

  it('pages with a pathway never load 3Dmol up front', () => {
    for (const page of ['/atlante-patologia/it/e/apoptosis/', '/atlante-patologia/en/pathways/intrinsic-apoptosis/']) {
      const files = staticJs(page);
      expect(files.some((f) => threeDmol.some((c) => f.endsWith(c))), page).toBe(false);
      const bytes = files.reduce((n, f) => n + gz(f), 0);
      console.info(`${page}: ${files.length} JS files, ${(bytes / KB).toFixed(1)} KB gz before the 3D button`);
    }
  });
});
