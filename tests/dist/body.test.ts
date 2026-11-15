/**
 * The interactive body on the built site: asset budgets (docs/BODY_SPEC.md §11), the lazy viewer chunk and the
 * weight of the page's static scripts. Run with `npm run test:dist` after `npm run build`.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { isMutableLazy, LAZY_ONLY, versionOf } from '../../scripts/sw-manifest.mjs';
import { DIST, pages, resolveFile, walk } from './lib.ts';

/** Limits in bytes. */
const LIMITS = {
  shellGlb: 400_000, // §11: the shell mesh
  systemGlb: 500_000, // §11: each system mesh
  manifest: 12_000, // §11: manifest.json
  anatomyTotal: 6_000_000, // §11: everything under dist/anatomy
  poster: 60_000, // §11: each poster-* file
  triangles: 250_000, // §11: shell and all systems together
  chunkGzip: 192_000, // §11: body-3d chunk gzip (ceiling 200,000)
  staticScriptsGzip: 20_000, // §11: static scripts of the body page together
};

const ANATOMY = join(DIST, 'anatomy');
const size = (f: string) => statSync(f).size;
const manifest = JSON.parse(readFileSync(join(ANATOMY, 'manifest.json'), 'utf8')) as {
  shell: { file: string; triangles: number };
  systems: Record<string, { file: string; triangles: number }>;
};
const chunks = readdirSync(join(DIST, '_astro')).filter((f) => /^body-3d\..+\.js$/.test(f));

describe('body assets', () => {
  it('the shell, each system, the manifest and the whole folder stay within budget', () => {
    expect(size(join(ANATOMY, 'shell.glb'))).toBeLessThanOrEqual(LIMITS.shellGlb);
    for (const { file } of Object.values(manifest.systems)) {
      expect(size(join(ANATOMY, file)), file).toBeLessThanOrEqual(LIMITS.systemGlb);
    }
    expect(size(join(ANATOMY, 'manifest.json'))).toBeLessThanOrEqual(LIMITS.manifest);
    const total = walk(ANATOMY).reduce((n, f) => n + size(f), 0);
    expect(total).toBeLessThanOrEqual(LIMITS.anatomyTotal);
  });

  it('each poster is small and the credits file is shipped', () => {
    const posters = readdirSync(ANATOMY).filter((f) => f.startsWith('poster-'));
    expect(posters.length).toBeGreaterThan(0);
    for (const f of posters) expect(size(join(ANATOMY, f)), f).toBeLessThanOrEqual(LIMITS.poster);
    expect(existsSync(join(ANATOMY, 'CREDITS.txt'))).toBe(true);
  });

  it('the triangles of the shell and all systems add up to the budget', () => {
    const total = manifest.shell.triangles + Object.values(manifest.systems).reduce((n, s) => n + s.triangles, 0);
    expect(total).toBeLessThanOrEqual(LIMITS.triangles);
  });
});

describe('body viewer chunk', () => {
  it('is one lazy chunk within the gzip ceiling, named as the sw-manifest rule expects', () => {
    expect(chunks).toHaveLength(1);
    expect(LAZY_ONLY.test(`_astro/${chunks[0]}`)).toBe(true);
    const gz = gzipSync(readFileSync(join(DIST, '_astro', chunks[0]!))).length;
    console.info(`body-3d chunk ${chunks[0]}: ${gz} bytes gz`);
    expect(gz).toBeLessThanOrEqual(LIMITS.chunkGzip);
  });

  it('is referenced by no page and is not precached', () => {
    for (const p of pages()) expect(p.html.includes(chunks[0]!), p.url).toBe(false);
    const precache = Object.keys(JSON.parse(readFileSync(join(DIST, 'precache.json'), 'utf8')).files as Record<string, string>);
    expect(precache.filter((p) => p.includes('body-3d'))).toEqual([]);
  });

  it('the static scripts of the Italian body page weigh little', () => {
    const html = readFileSync(join(DIST, 'it/body/index.html'), 'utf8');
    const urls = new Set([
      ...[...html.matchAll(/<script\b[^>]*\ssrc="([^"]+)"/g)].map((m) => m[1]!),
      ...[...html.matchAll(/<link\b[^>]*\brel="modulepreload"[^>]*\shref="([^"]+)"/g)].map((m) => m[1]!),
      ...[...html.matchAll(/<link\b[^>]*\shref="([^"]+)"[^>]*\brel="modulepreload"/g)].map((m) => m[1]!),
    ]);
    const total = [...urls].reduce((n, u) => n + gzipSync(readFileSync(resolveFile(u)!)).length, 0);
    console.info(`it/body static scripts: ${urls.size} files, ${total} bytes gz`);
    expect(total).toBeLessThanOrEqual(LIMITS.staticScriptsGzip);
  });
});

describe('worker caches of the lazy files', () => {
  const sw = readFileSync(join(DIST, 'sw.js'), 'utf8');
  const rel = (f: string) => f.slice(DIST.length + 1).split('\\').join('/');
  const sha = (f: string) => createHash('sha256').update(readFileSync(f)).digest('hex').slice(0, 16);

  it('the lazy cache is versioned by the anatomy and structure files alone, so a code deploy keeps it', () => {
    const files = Object.fromEntries(walk().filter((f) => isMutableLazy(rel(f))).map((f) => [rel(f), sha(f)]));
    expect(Object.keys(files).some((p) => p.startsWith('anatomy/'))).toBe(true);
    expect(sw).toContain(`const LAZY_VERSION = '${versionOf(files)}';`);
  });

  it('hashed _astro files go to a cache that a new worker does not delete', () => {
    expect(sw).toMatch(/const ASSETS = 'assets';/);
    expect(sw).toMatch(/!\[SHELL, ASSETS, LAZY\]\.includes\(k\)/);
  });
});

describe('poster preload', () => {
  it('the home page and the body page ask for the poster of the system colour scheme at high priority, with the URL of the picture', () => {
    for (const page of ['it/index.html', 'en/index.html', 'it/body/index.html', 'en/body/index.html']) {
      const html = readFileSync(join(DIST, page), 'utf8');
      for (const theme of ['light', 'dark']) {
        const link = html.match(new RegExp(`<link[^>]*rel="preload"[^>]*poster-${theme}\\.avif[^>]*>`))?.[0] ?? '';
        expect(link, `${page} ${theme}`).toContain('fetchpriority="high"');
        expect(link, `${page} ${theme}`).toContain(`media="(prefers-color-scheme: ${theme})"`);
        expect(html.indexOf(link), `${page} ${theme}: in the head`).toBeLessThan(html.indexOf('</head>'));
        const href = link.match(/href="([^"]+)"/)![1];
        expect(html, `${page} ${theme}: the picture uses the same address`).toContain(`srcset="${href}"`);
      }
    }
  });
});
