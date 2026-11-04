#!/usr/bin/env node
// Post-build service-worker manifest (ARCHITECTURE §4 step 5, D006).
//
//   node scripts/sw-manifest.mjs [distDir=dist]
//
// Writes, all paths relative to the site base (the worker resolves them
// against its scope, so the base path lives only in astro.config):
//   <dist>/precache.json            { version, files: { path: sha } }  app shell
//   <dist>/packs/<lang>/<module>.json { version, lang, module, bytes, files: { path: sha } }
// and stamps the precache version into <dist>/sw.js.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DIST = join(ROOT, process.argv[2] ?? 'dist');
const LANGS = ['it', 'en'];
const SHELL_PAGES = ['', ...LANGS.flatMap((l) => [`${l}/`, `${l}/offline/`, `${l}/me/offline/`])];
const SHELL_ASSET = /^_astro\/.+\.(css|js|woff2)$/;
// Heavy chunks that only a learner's click imports (3Dmol in structure-3d.ts, ~160 kB gz):
// never precached for every visitor; public/sw.js caches them on first use (hashedAsset).
// tests/dist/pathway.test.ts checks that the 3Dmol chunk still matches this name.
export const LAZY_ONLY = /^_astro\/structure-3d\.[^/]+\.js$/;
const STATIC_SHELL = ['manifest.webmanifest', 'favicon.svg'];
const IMAGE = /\.(avif|webp|png|jpe?g|gif|svg)$/i;

/** Is this dist path part of the precached app shell? (Structure files under structures/ never are.) */
export const isShellAsset = (p) => SHELL_ASSET.test(p) && !LAZY_ONLY.test(p);

const sha = (buf) => createHash('sha256').update(buf).digest('hex').slice(0, 16);
const posix = (p) => p.split(sep).join('/');

/** URL path (relative to base) → file in dist. `it/` → it/index.html. */
function fileFor(path) {
  return join(DIST, path === '' || path.endsWith('/') ? `${path}index.html` : path);
}

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
    d.isDirectory() ? walk(join(dir, d.name)) : [join(dir, d.name)],
  );
}

/** { path: sha } for existing paths; throws on a missing one (a broken shell must fail the build). */
function hashed(paths) {
  const files = {};
  for (const p of [...new Set(paths)].sort()) {
    const f = fileFor(p);
    if (!existsSync(f)) throw new Error(`sw-manifest: ${posix(relative(ROOT, f))} is missing`);
    files[p] = sha(readFileSync(f));
  }
  return files;
}

const versionOf = (files) => sha(Object.entries(files).map(([p, h]) => `${p} ${h}`).join('\n'));

/** Base-relative same-site image paths referenced by an HTML page (src, srcset, href). */
export function imagesIn(html, base) {
  const out = new Set();
  for (const m of html.matchAll(/\s(?:src|srcset|href)="([^"]+)"/g)) {
    for (const candidate of m[1].split(',')) {
      const u = candidate.trim().split(/\s+/)[0] ?? '';
      if (u.startsWith(base) && IMAGE.test(u.split(/[?#]/)[0])) out.add(u.slice(base.length).split(/[?#]/)[0]);
    }
  }
  return [...out];
}

function main() {
  if (!existsSync(join(DIST, 'sw.js'))) throw new Error(`sw-manifest: ${DIST}/sw.js not found — run astro build first`);
  // The base path, read from the built manifest (start_url = base).
  const base = JSON.parse(readFileSync(join(DIST, 'manifest.webmanifest'), 'utf8')).start_url;

  // ── Shell ──
  const all = walk(DIST).map((f) => posix(relative(DIST, f)));
  const shellPaths = [
    ...SHELL_PAGES,
    ...all.filter(isShellAsset),
    ...all.filter((p) => p.startsWith('icons/')),
    ...STATIC_SHELL,
  ];
  const shellFiles = hashed(shellPaths);
  const version = versionOf(shellFiles);
  writeFileSync(join(DIST, 'precache.json'), JSON.stringify({ version, files: shellFiles }));

  // ── Offline packs: one per language and module with at least one built page ──
  const entitiesDir = join(ROOT, 'src/content/entities');
  const byModule = new Map();
  for (const dir of readdirSync(entitiesDir)) {
    const metaFile = join(entitiesDir, dir, 'meta.yaml');
    if (!existsSync(metaFile)) continue;
    const { id, module } = parse(readFileSync(metaFile, 'utf8'));
    byModule.set(module, [...(byModule.get(module) ?? []), id]);
  }
  let packs = 0;
  for (const lang of LANGS) {
    for (const [module, ids] of byModule) {
      // Only pages the build actually rendered (drafts are not built in production).
      const pages = ids.map((id) => `${lang}/e/${id}/`).filter((p) => existsSync(fileFor(p)));
      if (pages.length === 0) continue;
      const images = pages.flatMap((p) => imagesIn(readFileSync(fileFor(p), 'utf8'), base)).filter((p) => !(p in shellFiles));
      const data = all.filter((p) => p.startsWith(`${lang}/data/`) && p.endsWith('.json'));
      const files = hashed([...pages, ...images, ...data]);
      const bytes = Object.keys(files).reduce((n, p) => n + statSync(fileFor(p)).size, 0);
      mkdirSync(join(DIST, 'packs', lang), { recursive: true });
      writeFileSync(
        join(DIST, 'packs', lang, `${module}.json`),
        JSON.stringify({ version: versionOf(files), lang, module, bytes, files }),
      );
      packs++;
    }
  }

  // ── Stamp the version into the worker so every shell change is a new worker ──
  const swFile = join(DIST, 'sw.js');
  const sw = readFileSync(swFile, 'utf8');
  const stamped = sw.replace("const VERSION = 'dev';", `const VERSION = '${version}';`);
  if (stamped === sw) throw new Error("sw-manifest: VERSION placeholder not found in sw.js");
  writeFileSync(swFile, stamped);

  console.log(`sw-manifest: shell ${Object.keys(shellFiles).length} files (version ${version}), ${packs} offline pack(s)`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
