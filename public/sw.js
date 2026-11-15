/*
 * Atlante di Patologia — service worker (hand-written, D006; ARCHITECTURE §5).
 *
 * - App shell (dist/precache.json, written by scripts/sw-manifest.mjs) is
 *   precached into `shell-<VERSION>` at install.
 * - Navigations: network first; offline → cached copy (shell or installed
 *   pack) → /<lang>/offline/.
 * - Hashed /_astro/ assets: cache first, stored on first use in `assets`, which a
 *   new deploy keeps (their names are content hashes: a changed file has a new
 *   name; the oldest are dropped past ASSETS_MAX). Structure files
 *   (/structures/*.bcif.gz, 3D pathways) and the body meshes and posters
 *   (/anatomy/) too, in `lazy-<LAZY_VERSION>`: their names stay and their content
 *   may change, so that cache lives as long as those files do, not as long as the
 *   shell. None of them is precached.
 * - Study data (/<lang>/data/*.json): network first, like navigations. Packs
 *   hold it under the same names in every deploy, so cache first would keep a
 *   learner on the questions, cards and indexes of the day they downloaded it.
 * - Everything else: served from cache only if a cache holds it (shell or an
 *   installed offline pack, `pack-<lang>-<module>-<hash>`), otherwise network.
 * - Cross-origin requests are never touched or cached.
 *
 * scripts/sw-manifest.mjs rewrites VERSION in dist/sw.js with the precache
 * hash, so a deploy that changes the shell changes this file and the browser
 * installs the new worker (the page then offers a reload: sw-register.ts).
 */
const VERSION = 'dev';
const LAZY_VERSION = 'dev'; // a hash of the files under anatomy/ and structures/ only (scripts/sw-manifest.mjs)
const SCOPE = new URL('./', self.location.href);
const BASE = SCOPE.pathname; // '/atlante-patologia/'
const SHELL = `shell-${VERSION}`;
const ASSETS = 'assets';
const LAZY = `lazy-${LAZY_VERSION}`;
const ASSETS_MAX = 400;
const DATA = /^[a-z]{2}\/data\//;
const LAZY_DIRS = ['_astro/', 'structures/', 'anatomy/'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const res = await fetch(new URL('precache.json', SCOPE), { cache: 'no-cache' });
      if (!res.ok) throw new Error(`precache.json: HTTP ${res.status}`);
      const { files } = await res.json();
      const cache = await caches.open(SHELL);
      // cache: 'reload' bypasses the HTTP cache so the shell matches this deploy.
      await cache.addAll(Object.keys(files).map((p) => new Request(new URL(p, SCOPE), { cache: 'reload' })));
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      // Packs are managed by the user from /<lang>/me/offline/, never deleted here.
      await Promise.all(keys.filter((k) => ![SHELL, ASSETS, LAZY].includes(k) && !k.startsWith('pack-')).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

// The page asks the waiting worker to take over after the user accepts the update.
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(BASE)) return;
  if (req.mode === 'navigate') event.respondWith(navigate(req, url));
  else if (LAZY_DIRS.some((d) => url.pathname.startsWith(BASE + d))) event.respondWith(hashedAsset(event, url));
  else if (DATA.test(url.pathname.slice(BASE.length))) event.respondWith(networkFirst(req));
  else event.respondWith(cachedOrNetwork(req));
});

async function navigate(req, url) {
  try {
    return await fetch(req);
  } catch (err) {
    const hit = await caches.match(req, { ignoreSearch: true });
    if (hit) return hit;
    const lang = url.pathname.startsWith(`${BASE}en/`) ? 'en' : 'it';
    const fallback = await caches.match(new URL(`${lang}/offline/`, SCOPE).href);
    if (fallback) return fallback;
    throw err;
  }
}

async function networkFirst(req) {
  try {
    return await fetch(req);
  } catch (err) {
    const hit = await caches.match(req);
    if (hit) return hit;
    throw err;
  }
}

async function hashedAsset(event, url) {
  const req = event.request;
  const hit = await caches.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok && res.type === 'basic') {
    const copy = res.clone();
    const permanent = url.pathname.startsWith(`${BASE}_astro/`);
    // Kept until the worker has written it: a slow link must not lose the copy when the page is done with the response.
    event.waitUntil(
      caches
        .open(permanent ? ASSETS : LAZY)
        .then(async (c) => {
          await c.put(req, copy);
          if (permanent) await trim(c);
        })
        .catch(() => {}),
    );
  }
  return res;
}

/** The oldest entries go first (keys() come in insertion order). */
async function trim(cache) {
  const keys = await cache.keys();
  await Promise.all(keys.slice(0, Math.max(0, keys.length - ASSETS_MAX)).map((k) => cache.delete(k)));
}

async function cachedOrNetwork(req) {
  return (await caches.match(req)) || fetch(req);
}
