/*
 * Atlante di Patologia — service worker (hand-written, D006; ARCHITECTURE §5).
 *
 * - App shell (dist/precache.json, written by scripts/sw-manifest.mjs) is
 *   precached into `shell-<VERSION>` at install.
 * - Navigations: network first; offline → cached copy (shell or installed
 *   pack) → /<lang>/offline/.
 * - Hashed /_astro/ assets: cache first, stored on first use. Structure files
 *   (/structures/*.bcif.gz, 3D pathways) too: they are never precached.
 * - Everything else: served from cache only if a cache holds it (shell or an
 *   installed offline pack, `pack-<lang>-<module>-<hash>`), otherwise network.
 * - Cross-origin requests are never touched or cached.
 *
 * scripts/sw-manifest.mjs rewrites VERSION in dist/sw.js with the precache
 * hash, so a deploy that changes the shell changes this file and the browser
 * installs the new worker (the page then offers a reload: sw-register.ts).
 */
const VERSION = 'dev';
const SCOPE = new URL('./', self.location.href);
const BASE = SCOPE.pathname; // '/atlante-patologia/'
const SHELL = `shell-${VERSION}`;

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
      await Promise.all(keys.filter((k) => k !== SHELL && !k.startsWith('pack-')).map((k) => caches.delete(k)));
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
  else if (url.pathname.startsWith(`${BASE}_astro/`) || url.pathname.startsWith(`${BASE}structures/`)) event.respondWith(hashedAsset(req));
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

async function hashedAsset(req) {
  const hit = await caches.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok && res.type === 'basic') {
    const copy = res.clone();
    caches.open(SHELL).then((c) => c.put(req, copy));
  }
  return res;
}

async function cachedOrNetwork(req) {
  return (await caches.match(req)) || fetch(req);
}
