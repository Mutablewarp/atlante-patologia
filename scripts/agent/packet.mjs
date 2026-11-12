#!/usr/bin/env node
/**
 * Packet of one card for the content agents (docs/agents/CONTRACTS.md §2).
 *   node scripts/agent/packet.mjs <id> [--extra "<printed pages>"]
 * Writes .work/packets/<id>/: row.json, source.txt, vocab.json, NOTES.md. The reference text (.work/fulltext.txt) is private:
 * each PDF page starts with `=== PAGE N ===`, and printed page = N - 24.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const PDF_OFFSET = 24;
const CAP_BYTES = 60_000;
/** The 13 section ids of src/i18n/sections.ts (tests/agent-packet.test.ts compares them). */
export const SECTION_IDS = ['definition', 'etiology', 'pathogenesis', 'gross', 'micro', 'ancillary', 'clinical', 'diagnosis', 'prognosis', 'differential', 'high-yield', 'traps', 'mnemonics'];
const P2_SECTIONS = ['definition', 'micro', 'diagnosis', 'differential', 'high-yield', 'traps'];

/** P0 core: 13 sections, 1200 words. P1 and P0 extended: 13, 800. P2: six sections, 500. */
export function depthFor({ priority, tier }) {
  if (priority === 'P2') return { sections: P2_SECTIONS, maxWordsEn: 500 };
  return { sections: SECTION_IDS, maxWordsEn: priority === 'P0' && tier === 'core' ? 1200 : 800 };
}

/** Printed pages named by a free-text `pages` cell: every `N` or `N–M`; words and (parentheses) are ignored. */
export function parsePages(text) {
  const pages = new Set();
  for (const [, a, b] of text.replace(/\([^)]*\)/g, ' ').matchAll(/(\d+)(?:\s*[–-]\s*(\d+))?/g))
    for (let p = +a; p <= Math.max(+a, +(b ?? a)); p++) pages.add(p);
  return [...pages].sort((x, y) => x - y);
}

/** PDF page number -> its text, from the `=== PAGE N ===` lines. */
export function splitPages(fulltext) {
  const parts = fulltext.split(/^=== PAGE (\d+) ===$/m);
  const pages = new Map();
  for (let i = 1; i < parts.length; i += 2) pages.set(+parts[i], parts[i + 1].trim());
  return pages;
}

/** `[p. N]` and the text of each printed page, in order, within `cap` bytes: later pages are dropped and named in the last line. */
export function buildSource(pages, texts, cap = CAP_BYTES) {
  const found = pages.filter((p) => texts.has(p + PDF_OFFSET));
  const blocks = found.map((p) => `[p. ${p}]\n${texts.get(p + PDF_OFFSET)}\n`);
  const note = (n) => `[truncated: printed pages ${found[n]}-${found.at(-1)} not included]\n`;
  const compose = (n) => (n < blocks.length ? [...blocks.slice(0, n), note(n)] : blocks).join('\n');
  let n = blocks.length;
  while (n > 0 && Buffer.byteLength(compose(n)) > cap) n--;
  return { text: compose(n), pages: found.slice(0, n), dropped: found.slice(n), missing: pages.filter((p) => !texts.has(p + PDF_OFFSET)) };
}

/** Ids a card may use: lens terms, existing entities (not `_` fixtures), planned ids and modules. */
export function buildVocab(root) {
  const read = (path) => parse(readFileSync(join(root, path), 'utf8'));
  const list = (dir) => (existsSync(join(root, dir)) ? readdirSync(join(root, dir)).sort() : []);
  const lenses = list('src/content/taxonomy').filter((f) => /\.ya?ml$/.test(f)).map((f) => read(`src/content/taxonomy/${f}`));
  const modules = read('src/content/modules.yaml');
  return {
    taxonomy: Object.fromEntries(lenses.map((l) => [l.lens, l.terms.map((t) => t.id)])),
    entities: list('src/content/entities').filter((d) => !d.startsWith('_') && existsSync(join(root, 'src/content/entities', d, 'meta.yaml'))),
    planned: modules.flatMap((m) => (m.planned ?? []).map((p) => p.id)),
    modules: modules.map((m) => m.id),
  };
}

/** The exemplar files named in docs/agents/BRIEF.md: its backticked paths of cards, ledgers and image yaml (not the `<id>` placeholders). */
function exemplars(root) {
  const brief = join(root, 'docs/agents/BRIEF.md');
  const paths = existsSync(brief) ? [...readFileSync(brief, 'utf8').matchAll(/`((?:src\/content\/(?:entities|images)|docs\/ledger)\/[a-z0-9._/-]+)`/g)] : [];
  return [...new Set(paths.map((m) => m[1]))];
}

function buildNotes(row, depth, src, { extra, want, exemplarPaths }) {
  const lines = [
    `# ${row.names.en} / ${row.names.it} (${row.id})`,
    `kind ${row.kind}, tier ${row.tier}, priority ${row.priority}, module ${row.module}, batch ${row.batch}`,
    `depth: ${depth.sections.length === SECTION_IDS.length ? 'all 13 sections' : depth.sections.join(', ')}; en.md at most ${depth.maxWordsEn} words`,
    `pages (printed): ${row.pages}${extra ? `; extra ${extra}` : ''}; source.txt holds ${src.pages.length}`,
  ];
  if (row.editionDependent) lines.push('WARNING: edition-dependent card (the classification changed between editions): the reference may be out of date; every grade, stage and cut-off needs a second source.');
  if (!want.length) lines.push('The reference has no section for this card: source.txt is empty.');
  if (src.missing.length) lines.push(`Not in the reference text: printed pages ${src.missing.join(', ')}.`);
  if (src.dropped.length) lines.push(`Cut at ${CAP_BYTES} bytes: printed pages ${src.dropped[0]}-${src.dropped.at(-1)} are not in source.txt.`);
  lines.push(`must cover: ${row.mustCover.join('; ')}`, `exemplar files: ${exemplarPaths.join(', ') || 'none named in docs/agents/BRIEF.md'}`);
  return `${lines.join('\n')}\n`;
}

/** Writes .work/packets/<id>/ under `root`; returns the number of pages and the bytes of source.txt. Throws with the reason on failure. */
export function buildPacket(id, { root = ROOT, extra = '' } = {}) {
  const manifest = join(root, '.work/manifest.json');
  const fulltext = join(root, '.work/fulltext.txt');
  for (const f of [manifest, fulltext]) if (!existsSync(f)) throw new Error(`${f} not found (scripts/agent/manifest.mjs writes the manifest; the reference text is private)`);
  const row = JSON.parse(readFileSync(manifest, 'utf8')).find((r) => r.id === id);
  if (!row) throw new Error(`"${id}" is not in the manifest`);
  // The seven `pattern` rows of the programme are comparison pages (src/content/patterns/), not entity cards: the pipeline has no flow for them yet.
  if (row.kind === 'pattern') throw new Error(`"${id}" is a pattern row: comparison pages live in src/content/patterns and have no pipeline yet`);
  const depth = depthFor(row);
  const want = parsePages(`${row.pages}; ${extra}`);
  const src = buildSource(want, splitPages(readFileSync(fulltext, 'utf8')));
  const dir = join(root, '.work/packets', id);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'row.json'), JSON.stringify({ ...row, depth }, null, 1));
  writeFileSync(join(dir, 'source.txt'), src.text);
  writeFileSync(join(dir, 'vocab.json'), JSON.stringify(buildVocab(root), null, 1));
  writeFileSync(join(dir, 'NOTES.md'), buildNotes(row, depth, src, { extra, want, exemplarPaths: exemplars(root) }));
  return { pages: src.pages.length, bytes: Buffer.byteLength(src.text) };
}

function main(args) {
  const [id] = args;
  const i = args.indexOf('--extra');
  if (!id || id.startsWith('--')) {
    console.error('Usage: node scripts/agent/packet.mjs <id> [--extra "<printed pages>"]');
    process.exit(2);
  }
  try {
    const { pages, bytes } = buildPacket(id, { extra: i < 0 ? '' : (args[i + 1] ?? '') });
    console.log(`packet ${id}: ${pages} pages, ${bytes} bytes`);
  } catch (e) {
    console.error(`packet: ${e.message}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main(process.argv.slice(2));
