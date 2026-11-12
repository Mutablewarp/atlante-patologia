#!/usr/bin/env node
// No-verbatim guard (COMPLIANCE_PLAN §1a): fails if any content file shares a 12-word run
// with a local reference, or if > 1% of its 8-word n-grams appear in a reference.
// Usage: node scripts/no-verbatim.mjs [paths...]   (default: src/content docs/ledger)
//        node scripts/no-verbatim.mjs --staged     (pre-commit: staged files under those dirs;
//                                                   exits 0 silently when .work/ does not exist)
// Reference text comes from gitignored .work/*.txt (extracted locally); absent in CI → skip.
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';
import { execFileSync } from 'node:child_process';

const WORK = process.env.NO_VERBATIM_WORK ?? '.work';
const RUN = 12;
const NGRAM = 8;
const MAX_RATIO = 0.01;
const EXT = new Set(['.md', '.mdx', '.yaml', '.yml', '.json', '.svg']);

function words(text) {
  return text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/<!--c:[^>]*-->/g, ' ') // our claim markers
    .replace(/-\s*\n\s*/g, '') // de-hyphenate line breaks
    .match(/[\p{L}\p{N}]+/gu) ?? [];
}

function grams(w, n) {
  const out = new Set();
  for (let i = 0; i + n <= w.length; i++) out.add(w.slice(i, i + n).join(' '));
  return out;
}

function walk(p, acc = []) {
  if (!existsSync(p)) return acc;
  if (statSync(p).isDirectory()) {
    for (const f of readdirSync(p)) if (!f.startsWith('.')) walk(join(p, f), acc);
  } else if (EXT.has(extname(p))) acc.push(p);
  return acc;
}

// --where: under each FAIL, the line numbers of the file (never reference text) that carry shared 8-grams, so an author knows what to rewrite.
const where = process.argv.includes('--where');
let args = process.argv.slice(2).filter((a) => a !== '--where');
if (args[0] === '--staged') {
  if (!existsSync(WORK)) process.exit(0); // no local references (CI, fresh clones, worktrees)
  // shortcut: checks the working-tree copy of each staged file, not the staged blob; fine unless partial staging is used.
  args = execFileSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z'], { encoding: 'utf8' })
    .split('\0')
    .filter((f) => /^(src\/content|docs\/ledger)\//.test(f));
  if (!args.length) process.exit(0);
}

const refFiles = existsSync(WORK) ? readdirSync(WORK).filter((f) => f.endsWith('.txt')).map((f) => join(WORK, f)) : [];
if (!refFiles.length) {
  console.log('no-verbatim: SKIPPED — no local reference text in .work/ (expected in CI). Run locally before publishing.');
  process.exit(0);
}

const ref8 = new Set();
const ref12 = new Set();
for (const f of refFiles) {
  const w = words(readFileSync(f, 'utf8'));
  for (const g of grams(w, NGRAM)) ref8.add(g);
  for (const g of grams(w, RUN)) ref12.add(g);
}

/** The lines of `text` (1-based, at most 40) holding a word of an 8-gram that the reference also has. Words are counted per line here, which is enough to locate. */
function sharedLines(text) {
  const toks = [];
  text.normalize('NFKC').toLowerCase().replace(/<!--c:[^>]*-->/g, ' ').split('\n').forEach((line, i) => {
    for (const w of line.match(/[\p{L}\p{N}]+/gu) ?? []) toks.push([w, i + 1]);
  });
  const lines = new Set();
  for (let i = 0; i + NGRAM <= toks.length; i++)
    if (ref8.has(toks.slice(i, i + NGRAM).map((t) => t[0]).join(' '))) for (let k = i; k < i + NGRAM; k++) lines.add(toks[k][1]);
  return [...lines].sort((a, b) => a - b).slice(0, 40);
}

const targets = (args.length ? args : ['src/content', 'docs/ledger']).flatMap((p) => walk(p));
let failed = 0;
for (const file of targets) {
  const w = words(readFileSync(file, 'utf8'));
  const g8 = grams(w, NGRAM);
  const g12 = grams(w, RUN);
  let shared8 = 0;
  for (const g of g8) if (ref8.has(g)) shared8++;
  const hits12 = [...g12].filter((g) => ref12.has(g));
  const ratio = g8.size ? shared8 / g8.size : 0;
  if (hits12.length || ratio > MAX_RATIO) {
    failed++;
    // Never print reference text; report counts only (and, with --where, the file's own line numbers).
    console.log(`FAIL ${file}: 8-gram overlap ${(ratio * 100).toFixed(2)}%, shared ${RUN}-word runs: ${hits12.length}`);
    if (where) console.log(`  lines: ${sharedLines(readFileSync(file, 'utf8')).join(', ')}`);
  }
}
console.log(`no-verbatim: ${targets.length} files checked against ${refFiles.length} reference text(s); ${failed} failed`);
process.exit(failed ? 1 : 0);
