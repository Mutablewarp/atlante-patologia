/**
 * /{lang}/me/offline/: install and remove offline packs, storage meter,
 * persistence status. A pack is the Cache Storage cache
 * `pack-<lang>-<module>-<version>` holding the files listed in
 * /packs/<lang>/<module>.json (scripts/sw-manifest.mjs); public/sw.js serves
 * from it when the network is unavailable.
 */
import { fmt } from '../i18n/index.ts';

type Pack = { version: string; bytes: number; files: Record<string, string> };

const root = document.querySelector<HTMLElement>('[data-offline-packs]');
const BASE = new URL(import.meta.env.BASE_URL.replace(/\/?$/, '/'), location.origin);

if (root) {
  const lang = root.dataset.lang ?? 'it';
  const S = JSON.parse(root.dataset.strings ?? '{}') as Record<string, string>;
  const locale = document.documentElement.lang === 'en' ? 'en-GB' : 'it-IT';
  const prefix = (m: string) => `pack-${lang}-${m}-`;

  const bytes = (n: number) => {
    const [unit, d] = n >= 1e9 ? ['gigabyte', 1e9] : n >= 1e6 ? ['megabyte', 1e6] : ['kilobyte', 1e3];
    return new Intl.NumberFormat(locale, { style: 'unit', unit, maximumFractionDigits: 1 }).format(n / (d as number));
  };

  async function fetchPack(m: string): Promise<Pack | undefined> {
    try {
      const res = await fetch(new URL(`packs/${lang}/${m}.json`, BASE), { cache: 'no-cache' });
      return res.ok ? ((await res.json()) as Pack) : undefined;
    } catch {
      return undefined; // offline: installed packs still show as installed
    }
  }

  async function installedKeys(m: string) {
    return (await caches.keys()).filter((k) => k.startsWith(prefix(m)));
  }

  function show(li: HTMLElement, state: 'none' | 'installed' | 'outdated' | 'working' | 'error', pack?: Pack) {
    const label = li.dataset.label ?? '';
    const install = li.querySelector<HTMLButtonElement>('[data-install]')!;
    const remove = li.querySelector<HTMLButtonElement>('[data-remove]')!;
    const stateText = { none: S.stateNone, installed: S.stateInstalled, outdated: S.stateOutdated, working: S.stateWorking, error: S.stateError }[state];
    li.querySelector('[data-state]')!.textContent = stateText ?? '';
    if (pack) li.querySelector('[data-size]')!.textContent = ` · ${bytes(pack.bytes)}`;
    const update = state === 'outdated';
    install.textContent = update ? S.update! : S.download!;
    install.setAttribute('aria-label', fmt(update ? S.updateLabel! : S.downloadLabel!, { module: label }));
    install.hidden = state === 'installed';
    remove.hidden = !(state === 'installed' || state === 'outdated');
    install.disabled = remove.disabled = state === 'working';
  }

  async function refresh(li: HTMLElement) {
    const m = li.dataset.pack!;
    const [pack, keys] = await Promise.all([fetchPack(m), installedKeys(m)]);
    if (keys.length === 0) show(li, 'none', pack);
    else show(li, !pack || keys.includes(prefix(m) + pack.version) ? 'installed' : 'outdated', pack);
  }

  async function install(li: HTMLElement) {
    const m = li.dataset.pack!;
    show(li, 'working');
    const pack = await fetchPack(m);
    const name = pack && prefix(m) + pack.version;
    try {
      if (!pack || !name) throw new Error('pack manifest unavailable');
      const cache = await caches.open(name);
      await cache.addAll(Object.keys(pack.files).map((p) => new URL(p, BASE).href));
      await Promise.all((await installedKeys(m)).filter((k) => k !== name).map((k) => caches.delete(k)));
      // A download is a meaningful action: ask for persistent storage (ARCHITECTURE §5).
      await navigator.storage?.persist?.().catch(() => false);
      show(li, 'installed', pack);
    } catch {
      if (name) await caches.delete(name); // never leave a half-filled pack
      show(li, 'error', pack);
    }
    await meters();
  }

  async function remove(li: HTMLElement) {
    show(li, 'working');
    await Promise.all((await installedKeys(li.dataset.pack!)).map((k) => caches.delete(k)));
    await refresh(li);
    await meters();
  }

  async function meters() {
    const storage = navigator.storage;
    const text = root!.querySelector('[data-storage-text]')!;
    const meter = root!.querySelector<HTMLMeterElement>('[data-storage-meter]')!;
    const est = await storage?.estimate?.().catch(() => undefined);
    if (est?.usage !== undefined && est.quota) {
      text.textContent = fmt(S.storageUsage!, { used: bytes(est.usage), quota: bytes(est.quota) });
      meter.max = est.quota;
      meter.value = est.usage;
      meter.hidden = false;
    }
    const persisted = await storage?.persisted?.().catch(() => undefined);
    if (persisted !== undefined) root!.querySelector('[data-persist-text]')!.textContent = persisted ? S.persistYes! : S.persistNo!;
  }

  if (!('serviceWorker' in navigator) || !('caches' in window)) {
    root.querySelector<HTMLElement>('[data-no-support]')!.hidden = false;
    root.querySelectorAll<HTMLElement>('.pack-actions').forEach((el) => (el.hidden = true));
  } else {
    root.querySelectorAll<HTMLElement>('[data-pack]').forEach((li) => {
      li.querySelector('[data-install]')!.addEventListener('click', () => install(li));
      li.querySelector('[data-remove]')!.addEventListener('click', () => remove(li));
      refresh(li);
    });
  }
  meters();
}

// Home Screen guidance is pointless inside the installed app.
const standalone =
  matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
if (standalone) {
  document.querySelector<HTMLElement>('[data-standalone]')!.hidden = false;
  document.querySelector<HTMLElement>('[data-install-help]')!.hidden = true;
}

export {};
