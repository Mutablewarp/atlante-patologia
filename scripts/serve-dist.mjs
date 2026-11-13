#!/usr/bin/env node
// Tiny static server for dist/, mounted at /atlante-patologia/ like GitHub Pages:
// directory URLs serve index.html (a missing trailing slash redirects), unknown
// paths get dist/404.html with status 404. Used by Playwright and Lighthouse.
// Text is sent as it is, unless createDistServer({ gzip: true }) is asked for (Lighthouse), because GitHub
// Pages sends it gzipped and a lab run on a 170 KB uncompressed card page scores 10 points lower.
//
//   node scripts/serve-dist.mjs [port]      (default 4321, or $PORT)
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const BASE = '/atlante-patologia/';
const DIST = fileURLToPath(new URL('../dist', import.meta.url));
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.xml': 'application/xml',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.woff2': 'font/woff2',
  '.wasm': 'application/wasm',
  '.txt': 'text/plain; charset=utf-8',
};

const isFile = (p) => existsSync(p) && statSync(p).isFile();
const COMPRESSIBLE = new Set(['.html', '.js', '.mjs', '.css', '.json', '.webmanifest', '.xml', '.svg', '.txt']);

export function createDistServer({ gzip = false } = {}) {
  const gzipped = new Map(); // shortcut: each file is compressed once and kept in memory; fine for a dist/ of a few hundred pages
  return createServer((req, res) => {
    const enc = gzip && /\bgzip\b/.test(req.headers['accept-encoding'] ?? '') ? gzipped : undefined;
    const { pathname, search } = new URL(req.url ?? '/', 'http://localhost');
    if (pathname === '/' || pathname === BASE.slice(0, -1)) return redirect(res, BASE + search);
    if (!pathname.startsWith(BASE)) return notFound(res, enc);
    let rel;
    try {
      rel = decodeURIComponent(pathname.slice(BASE.length));
    } catch {
      return notFound(res, enc);
    }
    const file = normalize(join(DIST, rel));
    if (file !== DIST && !file.startsWith(DIST + sep)) return notFound(res, enc); // no ../ escapes
    if (existsSync(file) && statSync(file).isDirectory()) {
      if (!pathname.endsWith('/')) return redirect(res, `${pathname}/${search}`);
      return send(res, join(file, 'index.html'), 200, enc);
    }
    return isFile(file) ? send(res, file, 200, enc) : notFound(res, enc);
  });
}

function send(res, file, status, enc) {
  if (!isFile(file)) return notFound(res, enc);
  const headers = { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' };
  if (enc && COMPRESSIBLE.has(extname(file))) {
    if (!enc.has(file)) enc.set(file, gzipSync(readFileSync(file)));
    const body = enc.get(file);
    return void res.writeHead(status, { ...headers, 'content-encoding': 'gzip', vary: 'accept-encoding', 'content-length': body.length }).end(body);
  }
  res.writeHead(status, headers);
  createReadStream(file).pipe(res);
}

function notFound(res, enc) {
  const page = join(DIST, '404.html');
  if (isFile(page)) return send(res, page, 404, enc);
  res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('Not found');
}

function redirect(res, location) {
  res.writeHead(301, { location }).end();
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.argv[2] ?? process.env.PORT ?? 4321);
  createDistServer().listen(port, '127.0.0.1', () => console.log(`dist/ at http://127.0.0.1:${port}${BASE}`));
}
