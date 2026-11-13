#!/usr/bin/env node
/**
 * Sets a module to `published` once every card planned for it is published.
 *
 *   node scripts/agent/module-status.mjs [--write]
 *
 * Prints one line per module: published cards, planned entries left, status. With --write a module with at least one
 * published card and an empty `planned` list gets `status: published`; a module is never set back to `planned`.
 * Run after sync-planned.mjs. The yaml is edited in place, so comments and order stay.
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isMap, parse, parseDocument } from 'yaml';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));

/** True when the module has a published card, nothing left in `planned` and is not published yet. Pure. */
function shouldFlip(m, counts) {
  return m.status !== 'published' && (counts.get(m.id) ?? 0) > 0 && (m.planned ?? []).length === 0;
}

/** One summary line per module. Pure. */
export function moduleLines(modules, counts) {
  return modules.map((m) => {
    const status = shouldFlip(m, counts) ? `${m.status} -> published` : m.status;
    return `${m.id}: ${counts.get(m.id) ?? 0} published, ${(m.planned ?? []).length} planned, ${status}`;
  });
}

/** Applies the flips to the yaml text; `changed` is false (and text unchanged) when there are none. */
export function applyStatus(text, counts) {
  const doc = parseDocument(text);
  const flipped = [];
  for (const m of doc.toJS() ?? []) if (shouldFlip(m, counts)) flipped.push(m.id);
  for (const id of flipped) {
    doc.contents.items.find((m) => isMap(m) && m.get('id') === id).set('status', 'published');
  }
  // lineWidth 0, as sync-planned.mjs: the default width folds the long `names` lines
  return { text: flipped.length ? doc.toString({ lineWidth: 0 }) : text, changed: flipped.length > 0, flipped };
}

/** Published cards per module id, from the `module` and `status` fields of each meta.yaml. */
export function publishedCounts(root) {
  const counts = new Map();
  const dir = join(root, 'src/content/entities');
  for (const id of readdirSync(dir)) {
    const file = join(dir, id, 'meta.yaml');
    if (!existsSync(file)) continue;
    const meta = parse(readFileSync(file, 'utf8'));
    if (meta?.status === 'published' && meta.module) counts.set(meta.module, (counts.get(meta.module) ?? 0) + 1);
  }
  return counts;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const file = join(ROOT, 'src/content/modules.yaml');
    const source = readFileSync(file, 'utf8');
    const counts = publishedCounts(ROOT);
    const write = process.argv.includes('--write');
    for (const line of moduleLines(parse(source) ?? [], counts)) console.log(line);
    const { text, changed, flipped } = applyStatus(source, counts);
    console.log(`module-status: ${flipped.length} to publish${write ? ' (written)' : ''}`);
    if (changed && write) writeFileSync(file, text);
  } catch (e) {
    console.error(`module-status: ${e.message}`);
    process.exit(2);
  }
}
