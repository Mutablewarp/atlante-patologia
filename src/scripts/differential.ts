/** Differential builder: re-rank on every checkbox change; the count goes to a live region. */
import { rankDifferential, type DiffEntity } from '../lib/differential.ts';

type Cfg = {
  entities: (DiffEntity & { name: string; url: string })[];
  labels: Record<string, string>;
  strings: Record<'count' | 'one' | 'none' | 'pick' | 'matched' | 'unmatched' | 'table' | 'score', string>;
};

const root = document.querySelector<HTMLElement>('[data-diff]');
if (root) {
  const cfg = JSON.parse(root.dataset.diff!) as Cfg;
  const S = cfg.strings;
  const fill = (tpl: string, v: Record<string, string | number>) => tpl.replace(/\{(\w+)\}/g, (_, k: string) => String(v[k] ?? ''));
  const byId = new Map(cfg.entities.map((e) => [e.id, e]));
  const form = root.querySelector<HTMLFormElement>('[data-diff-form]')!;
  const status = root.querySelector<HTMLElement>('[data-diff-status]')!;
  const list = root.querySelector<HTMLOListElement>('[data-diff-list]')!;
  const label = (f: string) => cfg.labels[f] ?? f;

  const line = (title: string, items: string[], cls: string) => {
    const p = document.createElement('p');
    p.className = `small ${cls}`;
    const b = document.createElement('strong');
    b.textContent = `${title}: `;
    p.append(b, items.map(label).join(', '));
    return p;
  };

  function update() {
    const selected = [...form.querySelectorAll<HTMLInputElement>('input[name="f"]:checked')].map((i) => i.value);
    const results = selected.length ? rankDifferential(cfg.entities, selected) : [];
    list.replaceChildren(
      ...results.map((r) => {
        const e = byId.get(r.id)!;
        const li = document.createElement('li');
        const a = document.createElement('a');
        a.href = e.url;
        a.className = 'diff-name';
        a.textContent = e.name;
        const score = document.createElement('span');
        score.className = 'badge badge-published';
        score.textContent = fill(S.score, { n: r.matched.length, total: selected.length });
        const table = document.createElement('a');
        table.href = `${e.url}#differential`;
        table.className = 'small';
        table.textContent = S.table;
        li.append(a, ' ', score, line(S.matched, r.matched, 'diff-matched'));
        if (r.unmatched.length) li.append(line(S.unmatched, r.unmatched, 'diff-unmatched muted'));
        li.append(table);
        return li;
      }),
    );
    status.textContent = !selected.length
      ? S.pick
      : results.length === 0
        ? S.none
        : results.length === 1
          ? S.one
          : fill(S.count, { n: results.length });
  }
  form.addEventListener('change', update);
  form.addEventListener('reset', () => setTimeout(update));
  update();
}

export {};
