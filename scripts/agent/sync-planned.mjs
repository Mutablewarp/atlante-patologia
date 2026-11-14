#!/usr/bin/env node
/**
 * Keeps the `planned` lists of src/content/modules.yaml true to the manifest.
 *
 *   node scripts/agent/sync-planned.mjs [--write]
 *
 * A manifest row (kind other than `pattern`) whose card is not published is listed under its module as { id, names };
 * a listed id whose card is now published is removed; ids outside the manifest are kept. Without --write it prints the
 * changes and exits 1 when there are any. The yaml is edited in place, so comments and order stay.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isMap, parse, parseDocument } from 'yaml';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));

/** Per module with a difference: { module, add: [{ id, names }], remove: [id] }. Pure. */
export function planChanges(modules, rows, published) {
  const byModule = new Map(modules.map((m) => [m.id, m]));
  const known = new Set(rows.map((r) => r.id));
  const changes = [];
  for (const m of modules) {
    const listed = new Set((m.planned ?? []).map((p) => p.id));
    const remove = [...listed].filter((id) => known.has(id) && published.has(id));
    const add = rows
      .filter((r) => r.module === m.id && r.kind !== 'pattern' && !published.has(r.id) && !listed.has(r.id))
      .map((r) => ({ id: r.id, names: { it: r.names.it, en: r.names.en } }));
    if (add.length || remove.length) changes.push({ module: m.id, add, remove });
  }
  return changes.filter((c) => byModule.has(c.module));
}

/** Applies the changes to the yaml text; `changed` is false (and text unchanged) when there are none. */
export function applyPlanned(text, rows, published) {
  const doc = parseDocument(text);
  const changes = planChanges(doc.toJS() ?? [], rows, published);
  for (const { module, add, remove } of changes) {
    const target = doc.contents.items.find((m) => isMap(m) && m.get('id') === module);
    let list = target.get('planned', true);
    if (!list) {
      list = doc.createNode([]);
      target.set('planned', list);
    }
    list.items = list.items.filter((p) => !remove.includes(p.get('id')));
    for (const item of add) {
      const node = doc.createNode(item);
      const names = node.get('names', true);
      names.flow = true;
      for (const pair of names.items) pair.value.type = 'QUOTE_DOUBLE'; // the quotes of the entries written by hand
      list.add(node);
    }
    if (!list.items.length) target.delete('planned');
  }
  // lineWidth 0, as finalize-batch.mjs: the default width folds every long `names` line, old ones included
  return { text: changes.length ? doc.toString({ lineWidth: 0 }) : text, changed: changes.length > 0, changes };
}

/** Ids of the manifest whose meta.yaml says `status: published`. */
export function publishedIds(root, rows) {
  const ids = new Set();
  for (const { id } of rows) {
    const file = join(root, 'src/content/entities', id, 'meta.yaml');
    if (existsSync(file) && parse(readFileSync(file, 'utf8'))?.status === 'published') ids.add(id);
  }
  return ids;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const rows = JSON.parse(readFileSync(join(ROOT, '.work/manifest.json'), 'utf8'));
    const file = join(ROOT, 'src/content/modules.yaml');
    const { text, changed, changes } = applyPlanned(readFileSync(file, 'utf8'), rows, publishedIds(ROOT, rows));
    const write = process.argv.includes('--write');
    const added = changes.reduce((n, c) => n + c.add.length, 0);
    const removed = changes.reduce((n, c) => n + c.remove.length, 0);
    for (const c of changes.slice(0, 25)) console.log(`${c.module}: +${c.add.length} -${c.remove.length}`);
    console.log(`sync-planned: ${added} to add, ${removed} to remove in ${changes.length} modules${write ? ' (written)' : ''}`);
    if (changed && write) writeFileSync(file, text);
    process.exit(changed && !write ? 1 : 0);
  } catch (e) {
    console.error(`sync-planned: ${e.message}`);
    process.exit(2);
  }
}
