#!/usr/bin/env node
/** Close a sub-batch (docs/agents/CONTRACTS.md §5, §6):  node scripts/agent/finalize-batch.mjs --batch W02
 * Rebuilds SELF_VERIFIED in src/lib/self-verified.ts from docs/ledger/*.yaml (rows whose `verifier` has "author" or "fixer",
 * exact counts), and merges .work/fragments/<id>/ of the finished cards of the batch into src/content/sources.yaml,
 * docs/REVIEW_QUEUE.md, docs/MISSING_ASSETS.md and, from planned.yaml (a list of { module, id, names }), the `planned`
 * lists of src/content/modules.yaml: one entry per id, one row per distinct text (the date does not count), so a second
 * run adds nothing. Prints a summary, writes only what changes, commits nothing; exit 1 when a fragment had a problem. */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isMap, isSeq, parse, parseDocument } from 'yaml';
import { cli, finished, manifestRows, option, ROOT } from './record.mjs';

/** One entry per ledger with self-checked rows, sorted by ledger id; and the ledgers that match no entity, pattern or pathway. */
export function selfVerified(root) {
  const read = (rel) => parse(readFileSync(join(root, rel), 'utf8'));
  const entries = [];
  const problems = [];
  for (const f of readdirSync(join(root, 'docs/ledger')).filter((n) => n.endsWith('.yaml')).sort()) {
    const { entity, claims } = read(`docs/ledger/${f}`);
    const n = (claims ?? []).filter((c) => /author|fixer/i.test(c.verifier)).length; // isSelfVerifier in src/lib/self-verified.ts
    if (!n) continue;
    const pathway = String(entity).match(/^pathway-(.+)$/)?.[1];
    const hit = [
      [pathway && `src/content/pathways/${pathway}.yaml`, 'title', `pathways/${pathway}/`],
      [`src/content/patterns/${entity}/meta.yaml`, 'names', `pattern/${entity}/`],
      [`src/content/entities/${entity}/meta.yaml`, 'names', `e/${entity}/`],
    ].find(([file]) => file && existsSync(join(root, file)));
    const name = hit && read(hit[0])[hit[1]];
    if (!name?.it || !name?.en) problems.push(`${f}: ${hit ? `${hit[0]} has no ${hit[1]}.it and .en` : `no entity, pattern or pathway "${entity}"`}`);
    else entries.push({ ledger: entity, claims: n, name: { it: name.it, en: name.en }, path: hit[2] });
  }
  return { entries: entries.sort((a, b) => (a.ledger < b.ledger ? -1 : 1)), problems };
}

const q = (s) => (s.includes("'") && !s.includes('"') ? `"${s}"` : `'${s.replaceAll('\\', '\\\\').replaceAll("'", "\\'")}'`);
// shortcut: a name wider than the line is not wrapped inside its entry (the formatter would); wrap by hand when it matters.
const entryText = ({ ledger, claims, name, path }) => {
  const nameText = `name: { it: ${q(name.it)}, en: ${q(name.en)} }`;
  const one = `  { ledger: ${q(ledger)}, claims: ${claims}, ${nameText}, path: ${q(path)} },`;
  return [...one].length <= 180 ? one : `  {\n    ledger: ${q(ledger)},\n    claims: ${claims},\n    ${nameText},\n    path: ${q(path)},\n  },`;
};
const LITERAL = /(export const SELF_VERIFIED: readonly SelfVerified\[\] = )\[(?:[\s\S]*?\n)?\];/;

/** `source` with the SELF_VERIFIED literal rebuilt from `entries`, in the file's own format; the rest is kept. */
export function renderSelfVerified(source, entries) {
  if (!LITERAL.test(source)) throw new Error('src/lib/self-verified.ts: the SELF_VERIFIED literal was not found');
  return source.replace(LITERAL, (_, head) => `${head}${entries.length ? `[\n${entries.map(entryText).join('\n')}\n]` : '[]'};`);
}

const rowText = (row) => row.replace(/^\|\s*\d{4}-\d{2}-\d{2}\s*\|/, '|').replace(/\s+/g, ' ');

const cell = (s) => s.replace(/\s+/g, ' ').trim().replaceAll('|', '\\|');
/**
 * Converters for a fragment line that is not a table row: the agents often write `- kind: text` instead of the 7 cells, and
 * such lines never reached the shared files. reviewRow keeps the whole line as the issue and lists the claim ids it names.
 */
export const reviewRow = (today) => (from, line) => {
  const text = line.replace(/^[-*]\s+/, '');
  const claims = [...new Set(text.match(new RegExp(`\\b${from}-c\\d{3}\\b`, 'g')) ?? [])].slice(0, 3);
  return `| ${today} | \`${from}\` | ${claims.map((c) => `\`${c}\``).join(', ') || '—'} | ${cell(text)} | open | agent | |`;
};
/** assetRow drops the leading card id (and date) of the line and reads the image role from its text. */
export const assetRow = (today) => (from, line) => {
  const text = line.replace(/^[-*]\s+/, '').replace(new RegExp(`^\`?${from}\`?\\s*(\\(\\d{4}-\\d{2}-\\d{2}\\))?\\s*:\\s*`), '');
  return `| ${today} | \`${from}\` | ${/\b(gross|micro|diagram|imaging|clinical)\b/.exec(text)?.[1] ?? '—'} | ${cell(text)} | — | — | open |`;
};

/**
 * Appends the new rows of the fragments after the last row of the file's table (7 cells); one row per distinct text.
 * `plain(from, line)` turns a line that is not a table row into one; without it such a line is left out.
 * @param {string} text
 * @param {{ from: string, text: string }[]} fragments
 * @param {((from: string, line: string) => string) | null} [plain]
 */
export function mergeRows(text, fragments, plain = null) {
  const lines = text.split('\n');
  const last = lines.findLastIndex((l) => l.startsWith('|'));
  if (last < 0) throw new Error('no table to append the rows to');
  const seen = new Set(lines.map(rowText));
  const fresh = [];
  const problems = [];
  for (const { from, text: t } of fragments) {
    for (const line of t.split('\n').map((l) => l.trim()).filter(Boolean)) {
      const row = line.startsWith('|') ? line : plain?.(from, line);
      if (!row) continue;
      if (row.split(/(?<!\\)\|/).length !== 9) problems.push(`${from}: not a 7-cell row: ${row.slice(0, 80)}`);
      else if (!seen.has(rowText(row))) {
        seen.add(rowText(row));
        fresh.push(row);
      }
    }
  }
  lines.splice(last + 1, 0, ...fresh);
  return { text: lines.join('\n'), added: fresh.length, problems };
}

/** Merges the YAML-list fragments into the YAML `text`; take(doc, item) is true when it took the item, false for a known one, else a problem. */
function mergeLists(text, fragments, file, take) {
  const doc = parseDocument(text);
  const problems = [];
  let added = 0;
  for (const { from, text: t } of fragments) {
    const frag = parseDocument(t);
    const ok = !frag.errors.length && (!frag.contents || isSeq(frag.contents));
    if (!ok) problems.push(`${from}: ${file} ${frag.errors[0]?.message.split('\n')[0] ?? 'is not a list'}`);
    for (const item of ok ? (frag.contents?.items ?? []) : []) {
      const result = take(doc, item);
      if (result === true) added++;
      else if (result) problems.push(`${from}: ${result}`);
    }
  }
  return { text: added ? doc.toString({ lineWidth: 0 }) : text, added, problems };
}

/** Appends the new entries to the sources, in the fragment's own format and with its comments: one entry per id. */
export const mergeSources = (text, fragments) =>
  mergeLists(text, fragments, 'sources.yaml', (doc, item) => {
    const id = isMap(item) ? item.get('id') : undefined;
    if (typeof id !== 'string') return 'a source entry has no id';
    if (doc.contents.items.some((s) => s.get('id') === id)) return false;
    item.spaceBefore = true;
    doc.contents.items.push(item);
    return true;
  });

/** Adds each { module, id, names } to the `planned` list of its module (made when there is none); a known id is skipped. */
export const mergePlanned = (text, fragments) =>
  mergeLists(text, fragments, 'planned.yaml', (doc, item) => {
    const [module, id] = isMap(item) ? [item.get('module'), item.get('id')] : [];
    const target = doc.contents.items.find((m) => m.get('id') === module);
    if (typeof id !== 'string') return 'a planned entry has no id';
    if (!target) return `planned ${id}: module ${module} is not in modules.yaml`;
    if (!item.has('names')) return `planned ${id}: no names`;
    if (doc.contents.items.some((m) => m.get('planned')?.items.some((p) => p.get('id') === id))) return false;
    item.delete('module');
    if (!target.get('planned')) target.set('planned', doc.createNode([]));
    target.get('planned').add(item);
    return true;
  });

const MERGES = [
  ['sources', 'sources.yaml', 'src/content/sources.yaml', mergeSources],
  ['reviewQueue', 'review-queue.md', 'docs/REVIEW_QUEUE.md', (text, fragments, today) => mergeRows(text, fragments, reviewRow(today))],
  ['missingAssets', 'missing-assets.md', 'docs/MISSING_ASSETS.md', (text, fragments, today) => mergeRows(text, fragments, assetRow(today))],
  ['planned', 'planned.yaml', 'src/content/modules.yaml', mergePlanned],
];

/** Rebuilds the self-verified entries and merges the fragments of the finished cards of `batch`; writes what changes. */
export function finalize({ root, batch, today = new Date().toISOString().slice(0, 10) }) {
  const rows = manifestRows(root, batch);
  const cards = rows.filter((r) => finished(root, r.id));
  const summary = { batch, cards: cards.length, unfinished: rows.length - cards.length };
  const problems = [];
  const edits = []; // written at the end, when nothing above threw
  const edit = (rel, old, text) => text !== old && edits.push([join(root, rel), text]);
  for (const [key, name, target, merge] of MERGES) {
    const fragments = cards.flatMap(({ id }) => {
      const file = join(root, '.work/fragments', id, name);
      return existsSync(file) ? [{ from: id, text: readFileSync(file, 'utf8') }] : [];
    });
    const old = readFileSync(join(root, target), 'utf8');
    const merged = merge(old, fragments, today);
    summary[key] = merged.added;
    problems.push(...merged.problems);
    edit(target, old, merged.text);
  }
  const sv = selfVerified(root);
  const old = readFileSync(join(root, 'src/lib/self-verified.ts'), 'utf8');
  const text = renderSelfVerified(old, sv.entries);
  edit('src/lib/self-verified.ts', old, text);
  summary.selfVerified = { entries: sv.entries.length, changed: text !== old };
  for (const [file, content] of edits) writeFileSync(file, content);
  return { ...summary, problems: [...problems, ...sv.problems] };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  cli('finalize-batch', () => {
    const batch = option(process.argv.slice(2), '--batch');
    if (!batch) throw new Error('usage: node scripts/agent/finalize-batch.mjs --batch W02');
    const { problems, ...summary } = finalize({ root: ROOT, batch });
    console.log(`finalize-batch: ${JSON.stringify(summary)}`);
    for (const p of problems.slice(0, 15)) console.log(`  problem ${p}`);
    if (problems.length > 15) console.log(`  ... and ${problems.length - 15} more`);
    process.exitCode = problems.length ? 1 : 0;
  });
}
