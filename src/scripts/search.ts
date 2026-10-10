/**
 * Search page: loads the self-hosted Pagefind bundle and renders results.
 * Pagefind reads <html lang> and loads that language's index.
 */
type PagefindResult = { data: () => Promise<{ url: string; excerpt: string; meta: { title?: string } }> };
type Pagefind = {
  options: (o: Record<string, unknown>) => Promise<void>;
  init: () => Promise<void>;
  debouncedSearch: (q: string, opts?: object, ms?: number) => Promise<{ results: PagefindResult[] } | null>;
};

const cfg = document.querySelector<HTMLElement>('[data-search-config]')!;
const strings = JSON.parse(cfg.dataset.strings ?? '{}') as Record<string, string>;
const input = document.querySelector<HTMLInputElement>('[data-page-search]')!;
const form = document.querySelector<HTMLFormElement>('[data-search-form]')!;
const status = document.querySelector<HTMLElement>('[data-search-status]')!;
const list = document.querySelector<HTMLOListElement>('[data-search-results]')!;
const fill = (tpl = '', v: Record<string, string | number>) => tpl.replace(/\{(\w+)\}/g, (_, k: string) => String(v[k] ?? ''));

let pagefind: Pagefind | null = null;
async function load(): Promise<Pagefind | null> {
  if (pagefind) return pagefind;
  try {
    pagefind = (await import(/* @vite-ignore */ cfg.dataset.bundle!)) as Pagefind;
    await pagefind.options({ baseUrl: cfg.dataset.base, excerptLength: 24 });
    await pagefind.init();
  } catch {
    status.textContent = strings.unavailable ?? '';
    pagefind = null;
  }
  return pagefind;
}

async function run(q: string) {
  const query = q.trim();
  const url = new URL(location.href);
  if (query) url.searchParams.set('q', query);
  else url.searchParams.delete('q');
  history.replaceState(null, '', url);
  if (!query) {
    status.textContent = '';
    list.replaceChildren();
    return;
  }
  status.textContent = strings.loading ?? '';
  const pf = await load();
  if (!pf) return;
  const search = await pf.debouncedSearch(query, {}, 200);
  if (!search) return; // superseded by a newer query
  const items = await Promise.all(search.results.slice(0, 30).map((r) => r.data()));
  list.replaceChildren(
    ...items.map((item) => {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = item.url;
      a.textContent = item.meta.title ?? item.url;
      const p = document.createElement('p');
      p.innerHTML = item.excerpt; // Pagefind escapes content and only adds <mark>
      li.append(a, p);
      return li;
    }),
  );
  status.textContent = items.length
    ? fill(strings.results, { n: search.results.length, q: query })
    : fill(strings.noResults, { q: query });
}

form.addEventListener('submit', (ev) => {
  ev.preventDefault();
  void run(input.value);
});
input.addEventListener('input', () => void run(input.value));
const initial = new URLSearchParams(location.search).get('q') ?? '';
if (initial) {
  input.value = initial;
  void run(initial);
}

export {};
