#!/usr/bin/env node
/**
 * Manifest of the planned cards: one row per card of the programme map, as JSON, for the content agents' tooling.
 *
 *   node scripts/agent/manifest.mjs [--in private/research/programme-entities.md] [--out .work/manifest.json] [--expect 378]
 *
 * The map is private (private/ is never committed); the manifest goes to .work/ (ignored). This script only reads the
 * map's tables: `| id | IT | EN | kind | tier | Rubin pp. | P | mod | prog | batch | must cover |`.
 * An id followed by ★ is already in modules.yaml `planned`; "P0 ⚠" marks a card that depends on a classification edition.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const KINDS = ['disease', 'process', 'concept', 'pattern', 'technique'];
const TIERS = ['core', 'extended'];

/** Parse the card tables of the programme map. Throws on a malformed row. */
export function parseProgramme(markdown) {
  const rows = [];
  let block = null;
  for (const line of markdown.split('\n')) {
    const heading = line.match(/^### (B\d{2}) /);
    if (heading) {
      block = heading[1];
      continue;
    }
    if (!/^\| `[a-z0-9-]+`/.test(line)) continue;
    if (!block) continue; // the conventions table before the first block names columns, not cards
    const cells = line.split('|').slice(1, -1).map((c) => c.trim());
    if (cells.length !== 11) throw new Error(`expected 11 cells, found ${cells.length}: ${line.slice(0, 90)}`);
    const [idCell, it, en, kind, tier, pages, priorityCell, module, prog, batch, mustCover] = cells;
    rows.push({
      id: idCell.match(/`([a-z0-9-]+)`/)[1],
      planned: idCell.includes('★'),
      block,
      names: { it, en },
      kind,
      tier,
      pages,
      priority: priorityCell.match(/P[012]/)?.[0] ?? null,
      editionDependent: priorityCell.includes('⚠'),
      module,
      prog,
      batch,
      mustCover: mustCover.split(';').map((s) => s.trim()).filter(Boolean),
    });
  }
  return rows;
}

/**
 * Problems in a parsed manifest: duplicate ids, values outside the allowed sets, unknown modules.
 * @param {Array<{ id: string }>} rows
 * @param {{ modules?: Set<string> | null }} [options]
 */
export function problems(rows, { modules = null } = {}) {
  const out = [];
  const seen = new Set();
  for (const r of rows) {
    if (seen.has(r.id)) out.push(`duplicate id ${r.id}`);
    seen.add(r.id);
    if (!KINDS.includes(r.kind)) out.push(`${r.id}: kind "${r.kind}"`);
    if (!TIERS.includes(r.tier)) out.push(`${r.id}: tier "${r.tier}"`);
    if (!r.priority) out.push(`${r.id}: no priority`);
    if (!/^W\d{2}$/.test(r.batch)) out.push(`${r.id}: batch "${r.batch}"`);
    if (!r.block) out.push(`${r.id}: outside a block heading`);
    if (modules && !modules.has(r.module)) out.push(`${r.id}: module "${r.module}" is not in modules.yaml`);
    if (!r.names.it || !r.names.en || r.mustCover.length === 0) out.push(`${r.id}: empty name or must-cover`);
  }
  return out;
}

/** Counts per batch, block and priority, for the run report. */
export function summary(rows) {
  const count = (key) => rows.reduce((acc, r) => ({ ...acc, [r[key]]: (acc[r[key]] ?? 0) + 1 }), {});
  return { cards: rows.length, perBatch: count('batch'), perBlock: count('block'), perPriority: count('priority') };
}

function option(args, name, fallback) {
  const i = args.indexOf(name);
  return i < 0 ? fallback : (args[i + 1] ?? fallback);
}

function main(args) {
  const input = join(ROOT, option(args, '--in', 'private/research/programme-entities.md'));
  const output = join(ROOT, option(args, '--out', '.work/manifest.json'));
  const expect = Number(option(args, '--expect', '378'));
  if (!existsSync(input)) {
    console.error(`manifest: ${input} not found (the programme map is private and lives on the owner's machine)`);
    process.exit(2);
  }
  const rows = parseProgramme(readFileSync(input, 'utf8')).map((r) => ({
    ...r,
    published: existsSync(join(ROOT, 'src/content/entities', r.id, 'meta.yaml')),
  }));
  const modulesText = readFileSync(join(ROOT, 'src/content/modules.yaml'), 'utf8');
  const modules = new Set([...modulesText.matchAll(/^- id: ([a-z0-9]+)\s*$/gm)].map((m) => m[1]));
  const found = problems(rows, { modules });
  if (rows.length !== expect) found.push(`expected ${expect} cards, found ${rows.length}`);
  if (found.length) {
    console.error(`manifest: ${found.length} problem(s)\n  ${found.slice(0, 20).join('\n  ')}`);
    process.exit(1);
  }
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, JSON.stringify(rows, null, 1));
  console.log(`manifest: ${rows.length} cards -> ${output}`);
  console.log(JSON.stringify(summary(rows)));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main(process.argv.slice(2));
