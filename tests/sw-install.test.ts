/**
 * The install step of public/sw.js, run in a vm with an in-memory Cache API: a worker for a new deploy copies the shell
 * files whose sha did not change from the earlier shell cache and fetches the rest.
 */
import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

const SOURCE = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');
const ORIGIN = 'https://example.test/atlante-patologia/';

type Store = Map<string, Map<string, Response>>;

/** A Cache API over a Map: names of caches, then URLs. */
function fakeCaches(store: Store) {
  const urlOf = (r: RequestInfo | URL) => (typeof r === 'string' ? r : r instanceof URL ? r.href : r.url);
  const cacheOf = (name: string) => {
    const entries = store.get(name)!;
    return {
      match: async (r: RequestInfo | URL) => entries.get(urlOf(r))?.clone(),
      put: async (r: RequestInfo | URL, res: Response) => void entries.set(urlOf(r), res.clone()),
      addAll: async (rs: Request[]) => {
        for (const r of rs) entries.set(r.url, await (globalThis as { __fetch: typeof fetch }).__fetch(r));
      },
      keys: async () => [...entries.keys()].map((u) => new Request(u)),
    };
  };
  return {
    open: async (name: string) => {
      if (!store.has(name)) store.set(name, new Map());
      return cacheOf(name);
    },
    keys: async () => [...store.keys()],
    delete: async (name: string) => store.delete(name),
    match: async (r: RequestInfo | URL) => {
      for (const entries of store.values()) if (entries.has(urlOf(r))) return entries.get(urlOf(r))!.clone();
      return undefined;
    },
  };
}

/** Installs the worker of one deploy: `files` is its precache.json, `body` what the server holds for each path. */
async function install(store: Store, version: string, files: Record<string, string>, requested: string[]) {
  const handlers: Record<string, (e: { waitUntil: (p: Promise<unknown>) => void }) => void> = {};
  const fetcher = async (input: RequestInfo | URL): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    requested.push(url.slice(ORIGIN.length));
    if (url.endsWith('precache.json')) return new Response(JSON.stringify({ version, files }), { status: 200 });
    const path = url.slice(ORIGIN.length);
    return new Response(`${path}@${files[path]}`, { status: 200 });
  };
  (globalThis as { __fetch?: typeof fetch }).__fetch = fetcher as typeof fetch;
  const context = createContext({
    URL,
    Request,
    Response,
    fetch: fetcher,
    caches: fakeCaches(store),
    self: { location: { href: `${ORIGIN}sw.js` }, addEventListener: (type: string, fn: never) => (handlers[type] = fn), clients: { claim: async () => {} }, skipWaiting: () => {} },
  });
  runInContext(SOURCE.replace("const VERSION = 'dev';", `const VERSION = '${version}';`).replace("const LAZY_VERSION = 'dev';", "const LAZY_VERSION = 'lazy';"), context);
  const pending: Promise<unknown>[] = [];
  handlers.install({ waitUntil: (p) => void pending.push(p) });
  await Promise.all(pending);
}

const shellFetches = (requested: string[]) => requested.filter((p) => p !== 'precache.json').sort();

describe('service worker install', () => {
  it('fetches every file of a first install', async () => {
    const store: Store = new Map();
    const requested: string[] = [];
    await install(store, 'v1', { 'it/': 'a1', '_astro/app.js': 'b1', 'favicon.svg': 'c1' }, requested);
    expect(shellFetches(requested)).toEqual(['_astro/app.js', 'favicon.svg', 'it/']);
    expect([...store.get('shell-v1')!.keys()]).toHaveLength(4); // the three files and the record of their shas
  });

  it('copies what did not change from the earlier shell and fetches only what did', async () => {
    const store: Store = new Map();
    await install(store, 'v1', { 'it/': 'a1', '_astro/app.js': 'b1', 'favicon.svg': 'c1' }, []);
    const requested: string[] = [];
    await install(store, 'v2', { 'it/': 'a2', '_astro/app.js': 'b1', 'favicon.svg': 'c1' }, requested);
    expect(shellFetches(requested)).toEqual(['it/']);
    const next = store.get('shell-v2')!;
    expect(await next.get(`${ORIGIN}it/`)!.text()).toBe('it/@a2');
    expect(await next.get(`${ORIGIN}_astro/app.js`)!.text()).toBe('_astro/app.js@b1');
    expect(await next.get(`${ORIGIN}favicon.svg`)!.text()).toBe('favicon.svg@c1');
  });

  it('a file that is new in the deploy is fetched, and one that is gone is not kept', async () => {
    const store: Store = new Map();
    await install(store, 'v1', { 'it/': 'a1', 'old.css': 'x1' }, []);
    const requested: string[] = [];
    await install(store, 'v2', { 'it/': 'a1', 'new.css': 'y1' }, requested);
    expect(shellFetches(requested)).toEqual(['new.css']);
    expect([...store.get('shell-v2')!.keys()].some((u) => u.endsWith('old.css'))).toBe(false);
  });

  it('fetches everything when the earlier shell has no record of its shas', async () => {
    const store: Store = new Map([['shell-v0', new Map([[`${ORIGIN}it/`, new Response('it/@a1')]])]]);
    const requested: string[] = [];
    await install(store, 'v1', { 'it/': 'a1' }, requested);
    expect(shellFetches(requested)).toEqual(['it/']);
  });
});
