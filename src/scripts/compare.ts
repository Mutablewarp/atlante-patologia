/**
 * Compare page: state lives in `?ids=a,b,c` (2–4 ids). Builds an accessible
 * table (caption, th scope, labelled focusable scroll region) from
 * data/index.json (names, summary) and data/quick.json (quick section HTML,
 * rendered at build time from our own Markdown).
 */
type Cfg = {
  index: string;
  quick: string;
  entityBase: string;
  sections: { id: string; title: string }[];
  strings: Record<'caption' | 'section' | 'remove' | 'needTwo' | 'max' | 'updated' | 'loading' | 'error', string>;
};
type IndexEntity = { id: string; url: string; names: { it: string; en: string }; summary: string };

const root = document.querySelector<HTMLElement>('[data-compare]');
if (root) void init(root);

async function init(root: HTMLElement) {
  const cfg = JSON.parse(root.dataset.compare!) as Cfg;
  const lang = document.documentElement.lang as 'it' | 'en';
  const S = cfg.strings;
  const fill = (tpl: string, v: Record<string, string | number>) => tpl.replace(/\{(\w+)\}/g, (_, k: string) => String(v[k] ?? ''));
  const status = root.querySelector<HTMLElement>('[data-compare-status]')!;
  const chosenList = root.querySelector<HTMLUListElement>('[data-chosen]')!;
  const tableBox = root.querySelector<HTMLElement>('[data-compare-table]')!;
  const select = root.querySelector<HTMLSelectElement>('#compare-pick')!;

  status.textContent = S.loading;
  let byId: Map<string, IndexEntity>;
  let quick: Record<string, Record<string, string>>;
  try {
    const [idx, q] = await Promise.all([fetch(cfg.index).then((r) => r.json()), fetch(cfg.quick).then((r) => r.json())]);
    byId = new Map((idx.entities as IndexEntity[]).map((e) => [e.id, e]));
    quick = q;
  } catch {
    status.textContent = S.error;
    return;
  }

  let ids = (new URLSearchParams(location.search).get('ids') ?? '')
    .split(',')
    .filter((id, i, all) => byId.has(id) && all.indexOf(id) === i)
    .slice(0, 4);

  const el = <K extends keyof HTMLElementTagNameMap>(tag: K, props: Partial<HTMLElementTagNameMap[K]> = {}, ...kids: (Node | string)[]) => {
    const n = Object.assign(document.createElement(tag), props);
    n.append(...kids);
    return n;
  };
  const cellHtml = (html: string) => {
    const td = el('td');
    td.innerHTML = html; // build-time HTML from our own Markdown, served from this site
    return td;
  };

  function render(announce: boolean) {
    history.replaceState(null, '', ids.length ? `?ids=${ids.join(',')}` : location.pathname);
    for (const o of select.options) o.disabled = ids.includes(o.value);
    if (select.selectedOptions[0]?.disabled) select.value = [...select.options].find((o) => !o.disabled)?.value ?? '';

    chosenList.replaceChildren(
      ...ids.map((id) => {
        const name = byId.get(id)!.names[lang];
        const btn = el('button', { type: 'button', className: 'btn btn-small' }, '×');
        btn.setAttribute('aria-label', fill(S.remove, { name }));
        btn.addEventListener('click', () => {
          ids = ids.filter((x) => x !== id);
          render(true);
          select.focus();
        });
        return el('li', {}, el('a', { href: byId.get(id)!.url }, name), ' ', btn);
      }),
    );

    if (ids.length < 2) {
      tableBox.replaceChildren();
      status.textContent = S.needTwo;
      return;
    }
    const names = ids.map((id) => byId.get(id)!.names[lang]);
    const caption = el('caption', { id: 'compare-caption' }, fill(S.caption, { names: names.join(', ') }));
    const head = el(
      'tr',
      {},
      el('th', { scope: 'col' }, S.section),
      ...ids.map((id) => el('th', { scope: 'col' }, el('a', { href: byId.get(id)!.url }, byId.get(id)!.names[lang]))),
    );
    const rows = cfg.sections.map((s) =>
      el(
        'tr',
        {},
        el('th', { scope: 'row' }, s.title),
        ...ids.map((id) =>
          s.id === 'summary' ? el('td', {}, byId.get(id)!.summary) : cellHtml(quick[id]?.[s.id] ?? '—'),
        ),
      ),
    );
    const table = el('table', { className: 'matrix compare-table' }, caption, el('thead', {}, head), el('tbody', {}, ...rows));
    const region = el('div', { className: 'table-scroll', tabIndex: 0 }, table);
    region.setAttribute('role', 'region');
    region.setAttribute('aria-labelledby', 'compare-caption');
    tableBox.replaceChildren(region);
    status.textContent = announce ? fill(S.updated, { n: ids.length }) : '';
  }

  root.querySelector('[data-compare-form]')!.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const id = select.value;
    if (!id || ids.includes(id)) return;
    if (ids.length >= 4) {
      status.textContent = S.max;
      return;
    }
    ids = [...ids, id];
    render(true);
  });
  render(false);
}

export {};
