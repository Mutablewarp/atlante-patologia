/**
 * The Licences page reproduces the copyright notice of every library whose
 * code the site ships to the browser (COMPLIANCE_PLAN §2 item 1), as the
 * installed package states it, in both languages.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DIST, LANGS } from './lib.ts';

/** Licence file of each library in dist/_astro or dist/pagefind (the 3D view's bundle has its own sub-section). */
const SHIPPED = [
  'astro/LICENSE',
  '@astrojs/preact/LICENSE',
  'preact/LICENSE',
  '@preact/signals/LICENSE',
  '@preact/signals-core/LICENSE',
  'idb/LICENSE',
  'ts-fsrs/LICENSE',
  'pagefind/LICENSE/LICENSE',
  '3dmol/LICENSE',
];
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

describe('third-party notices', () => {
  for (const lang of LANGS)
    it(`${lang}/about/licenses/ reproduces the notice of every library the site runs`, () => {
      const html = readFileSync(join(DIST, lang, 'about/licenses/index.html'), 'utf8');
      for (const file of SHIPPED) {
        const notice = readFileSync(join(process.cwd(), 'node_modules', file), 'utf8');
        const line = notice.split('\n').find((l) => /copyright/i.test(l))!.trim();
        expect(html, file).toContain(esc(line));
      }
    });
});
