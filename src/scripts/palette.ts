/**
 * Command palette (Ctrl/⌘ K, or the top-bar button). Lazy-loaded by shell.ts.
 * Modal <dialog> with the ARIA combobox + listbox pattern: fuzzy search over
 * entities, patterns, glossary and pages (data/index.json), then Pagefind
 * full-text results. Escape closes and focus returns to where it was.
 */
import { fold, bestScore } from '../lib/fuzzy.ts';
import '../styles/palette.css';

type Cfg = {
  index: string;
  search: string;
  bundle: string;
  base: string;
  strings: Record<string, string>;
};
type Item = { kind: string; title: string; sub?: string; url: string; keys: string[] };
type Index = {
  entities: { url: string; names: { it: string; en: string; latin?: string; synonyms: { it: string[]; en: string[] }; eponyms: string[]; abbreviations: string[] }; summary: string; lenses: Record<string, string[]> }[];
  patterns: { url: string; name: string; altName: string; summary: string }[];
  glossary: { url: string; term: string; altTerm: string; aliases: string[]; definition: string }[];
  lenses: Record<string, { label: string; terms: Record<string, string> }>;
  pages: { title: string; url: string }[];
};
type Pagefind = {
  options: (o: object) => Promise<void>;
  init: () => Promise<void>;
  debouncedSearch: (q: string, o?: object, ms?: number) => Promise<{ results: { data: () => Promise<{ url: string; excerpt: string; meta: { title?: string } }> }[] } | null>;
};

let dialog: HTMLDialogElement | undefined;
let items: Promise<Item[]> | undefined;
let pagefind: Promise<Pagefind | null> | undefined;

export function openPalette(opener: HTMLButtonElement) {
  const cfg = JSON.parse(opener.dataset.palette!) as Cfg;
  const back = document.activeElement as HTMLElement | null;
  dialog ??= build(cfg);
  items ??= loadItems(cfg);
  dialog.addEventListener('close', () => (back ?? opener).focus(), { once: true });
  if (!dialog.open) dialog.showModal();
  const input = dialog.querySelector('input')!;
  input.select();
  input.dispatchEvent(new Event('input'));
}

async function loadItems(cfg: Cfg): Promise<Item[]> {
  const lang = document.documentElement.lang as 'it' | 'en';
  const S = cfg.strings;
  const idx = (await fetch(cfg.index).then((r) => r.json())) as Index;
  const used = new Map<string, Set<string>>();
  for (const e of idx.entities)
    for (const [lens, terms] of Object.entries(e.lenses)) for (const t of terms) (used.get(lens) ?? used.set(lens, new Set()).get(lens)!).add(t);
  const lensBase = cfg.index.replace(/data\/index\.json$/, 'atlas/');
  return [
    ...idx.entities.map((e) => {
      const n = e.names;
      return {
        kind: S.entity!,
        title: n[lang],
        sub: n[lang === 'it' ? 'en' : 'it'],
        url: e.url,
        keys: [n.it, n.en, n.latin ?? '', ...n.synonyms.it, ...n.synonyms.en, ...n.eponyms, ...n.abbreviations],
      };
    }),
    ...idx.patterns.map((p) => ({ kind: S.pattern!, title: p.name, sub: p.altName, url: p.url, keys: [p.name, p.altName] })),
    ...idx.glossary.map((g) => ({ kind: S.glossary!, title: g.term, sub: g.definition, url: g.url, keys: [g.term, g.altTerm, ...g.aliases] })),
    ...idx.pages.map((p) => ({ kind: S.page!, title: p.title, url: p.url, keys: [p.title] })),
    ...Object.entries(idx.lenses).flatMap(([lens, l]) => [
      { kind: S.page!, title: l.label, url: `${lensBase}${lens}/`, keys: [l.label] },
      ...[...(used.get(lens) ?? [])].map((t) => ({
        kind: S.page!,
        title: l.terms[t] ?? t,
        sub: l.label,
        url: `${lensBase}${lens}/${t}/`,
        keys: [l.terms[t] ?? t],
      })),
    ]),
  ].map((it) => ({ ...it, keys: it.keys.filter(Boolean).map(fold) }));
}

function loadPagefind(cfg: Cfg) {
  pagefind ??= (async () => {
    try {
      const pf = (await import(/* @vite-ignore */ cfg.bundle)) as Pagefind;
      await pf.options({ baseUrl: cfg.base, excerptLength: 14 });
      await pf.init();
      return pf;
    } catch {
      return null; // no index in dev builds; local results still work
    }
  })();
  return pagefind;
}

function build(cfg: Cfg): HTMLDialogElement {
  const S = cfg.strings;
  const d = document.createElement('dialog');
  d.className = 'palette';
  d.setAttribute('aria-labelledby', 'palette-title');
  d.innerHTML = `
    <form method="dialog" class="palette-head">
      <h2 id="palette-title" class="visually-hidden"></h2>
      <input id="palette-input" type="text" role="combobox" aria-expanded="true" aria-controls="palette-list"
        aria-autocomplete="list" autocomplete="off" spellcheck="false" />
      <button class="icon-btn" value="close" type="submit"><span aria-hidden="true">×</span></button>
    </form>
    <ul id="palette-list" role="listbox"></ul>
    <p class="palette-status small muted" role="status" aria-live="polite"></p>
    <p class="palette-hint small muted" aria-hidden="true"></p>`;
  d.querySelector('h2')!.textContent = S.title!;
  const input = d.querySelector('input')!;
  input.setAttribute('aria-label', S.label!);
  input.placeholder = S.placeholder!;
  d.querySelector('.palette-head button')!.setAttribute('aria-label', S.close!);
  d.querySelector('.palette-hint')!.textContent = S.hint!;
  const list = d.querySelector<HTMLUListElement>('#palette-list')!;
  list.setAttribute('aria-label', S.label!);
  const status = d.querySelector<HTMLElement>('.palette-status')!;
  // Backdrop click closes.
  d.addEventListener('click', (ev) => ev.target === d && d.close());

  let options: { el: HTMLLIElement; url: string }[] = [];
  let active = -1;
  let seq = 0;
  const setActive = (i: number) => {
    options[active]?.el.setAttribute('aria-selected', 'false');
    active = options.length ? (i + options.length) % options.length : -1;
    const o = options[active];
    if (!o) return input.removeAttribute('aria-activedescendant');
    o.el.setAttribute('aria-selected', 'true');
    input.setAttribute('aria-activedescendant', o.el.id);
    o.el.scrollIntoView({ block: 'nearest' });
  };
  const go = (url: string) => {
    d.close();
    location.href = url;
  };
  const render = (found: Item[], q: string) => {
    const all = q ? [...found, { kind: '', title: S.all!.replace('{q}', q), url: `${cfg.search}?q=${encodeURIComponent(q)}`, keys: [] }] : found;
    list.replaceChildren();
    options = all.map((it, i) => {
      const li = document.createElement('li');
      li.id = `palette-opt-${i}`;
      li.setAttribute('role', 'option');
      li.setAttribute('aria-selected', 'false');
      if (it.kind) {
        const k = document.createElement('span');
        k.className = 'palette-kind';
        k.textContent = it.kind;
        li.append(k, ' ');
      }
      const t = document.createElement('span');
      t.className = 'palette-title';
      t.textContent = it.title;
      li.append(t);
      if (it.sub) {
        const s = document.createElement('span');
        s.className = 'palette-sub';
        s.textContent = it.sub;
        li.append(' ', s);
      }
      li.addEventListener('click', () => go(it.url));
      li.addEventListener('pointermove', () => active !== i && setActive(i));
      list.append(li);
      return { el: li, url: it.url };
    });
    setActive(0);
    status.textContent = found.length ? S.results!.replace('{n}', String(found.length)) : q ? S.none! : '';
  };

  input.addEventListener('input', async () => {
    const my = ++seq;
    const q = input.value.trim();
    const fq = fold(q);
    let all: Item[];
    try {
      all = await items!;
    } catch {
      all = [];
    }
    if (my !== seq) return;
    const local = fq
      ? all
          .map((it) => ({ it, s: bestScore(fq, it.keys) }))
          .filter((x) => x.s > 0)
          .sort((a, b) => b.s - a.s)
          .slice(0, 8)
          .map((x) => x.it)
      : all.filter((it) => it.kind === S.page).slice(0, 8);
    render(local, q);
    if (q.length < 3) return;
    const pf = await loadPagefind(cfg);
    const res = pf ? await pf.debouncedSearch(q, {}, 250) : null;
    if (!res || my !== seq) return;
    const seen = new Set(local.map((x) => x.url));
    const extra = (await Promise.all(res.results.slice(0, 6).map((r) => r.data())))
      .filter((r) => !seen.has(r.url))
      .slice(0, 5)
      .map((r) => ({
        kind: S.fulltext!,
        title: r.meta.title ?? r.url,
        sub: r.excerpt.replace(/<[^>]+>/g, ''),
        url: r.url,
        keys: [],
      }));
    if (my === seq) render([...local, ...extra], q);
  });
  input.addEventListener('keydown', (ev) => {
    if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
      ev.preventDefault();
      setActive(active + (ev.key === 'ArrowDown' ? 1 : -1));
    } else if (ev.key === 'Enter') {
      ev.preventDefault();
      const o = options[active];
      if (o) go(o.url);
    }
  });
  document.body.append(d);
  return d;
}
