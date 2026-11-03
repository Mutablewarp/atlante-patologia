/**
 * Registers the service worker (public/sw.js) under the site base and offers
 * a reload when a new version is waiting. Production builds only: in
 * `astro dev` there is no precache.json.
 */
const BASE = import.meta.env.BASE_URL.endsWith('/') ? import.meta.env.BASE_URL : `${import.meta.env.BASE_URL}/`;

function offerUpdate(worker: ServiceWorker) {
  const notice = document.querySelector<HTMLElement>('[data-update-notice]');
  if (!notice) return;
  notice.hidden = false;
  notice.querySelector('[data-update-reload]')?.addEventListener('click', () => worker.postMessage({ type: 'SKIP_WAITING' }), {
    once: true,
  });
  notice.querySelector('[data-update-later]')?.addEventListener('click', () => (notice.hidden = true), { once: true });
}

async function register() {
  // Only an update (a page already controlled when it loaded) needs the notice; the first
  // install is silent. Decided at load: WebKit can report the first worker as `controller`
  // before its 'installed' state event, which made a first visit show the notice and reload.
  const controlledAtLoad = !!navigator.serviceWorker.controller;
  const reg = await navigator.serviceWorker.register(`${BASE}sw.js`, { scope: BASE });
  if (reg.waiting && controlledAtLoad) offerUpdate(reg.waiting);
  reg.addEventListener('updatefound', () => {
    const worker = reg.installing;
    worker?.addEventListener('statechange', () => {
      if (worker.state === 'installed' && controlledAtLoad) offerUpdate(worker);
    });
  });
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // Reload only after the user asked for the update (not on the first claim).
    if (reloading || !document.querySelector<HTMLElement>('[data-update-notice]:not([hidden])')) return;
    reloading = true;
    location.reload();
  });
}

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  register().catch(() => {
    /* offline support is an enhancement: the site works without it */
  });
}

export {};
