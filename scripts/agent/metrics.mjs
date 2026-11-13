#!/usr/bin/env node
/**
 * Metrics row of a sub-batch (plan I-11): appends one row to the "## V3 batch metrics" table at the end of docs/PROGRESS.md.
 *
 *   node scripts/agent/metrics.mjs --batch W02 --cards 8 --tokens 3200000 --audit-total 40 --audit-wrong 1 --kb-per-card 380 --ci first-try [--file docs/PROGRESS.md]
 *
 * Creates the heading and the table header when they are missing. A row of the same batch is replaced, not repeated. Prints the row. Exits 2 on a missing or bad option.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const HEADING = '## V3 batch metrics';
const HEADER = ['| Batch | Date | Cards | Tokens per card | Audit error rate | kB per card | CI |', '|---|---|---:|---:|---:|---:|---|'];

/** The value after `name`, undefined when the option is absent. Throws when the value is missing, empty or another flag. */
function optionValue(args, name) {
  if (!args.includes(name)) return undefined;
  const value = args[args.indexOf(name) + 1];
  if (value === undefined || value.trim() === '' || value.startsWith('--')) throw new Error(`${name} needs a value`);
  return value;
}

/** Command-line options as numbers and text. Throws a message for the user on a missing or bad value. */
export function parseArgs(args) {
  const option = (name) => optionValue(args, name);
  const number = (name) => {
    const value = Number(option(name) ?? NaN);
    if (!(value >= 0)) throw new Error(`${name} needs a number, 0 or more`);
    return value;
  };
  const text = (name) => {
    const value = (option(name) ?? '').replace(/[\s|]+/g, ' ').trim(); // a pipe or a line break would break the table
    if (!value) throw new Error(`${name} is required`);
    return value;
  };
  const metrics = { batch: text('--batch'), cards: number('--cards'), tokens: number('--tokens'), auditTotal: number('--audit-total'), auditWrong: number('--audit-wrong'), kbPerCard: number('--kb-per-card'), ci: text('--ci') };
  if (!Number.isInteger(metrics.cards) || metrics.cards < 1) throw new Error('--cards must be a whole number, 1 or more');
  if (!Number.isInteger(metrics.auditTotal) || !Number.isInteger(metrics.auditWrong) || metrics.auditWrong > metrics.auditTotal)
    throw new Error('--audit-total and --audit-wrong must be whole numbers, with --audit-wrong not above --audit-total');
  return metrics;
}

/** One table row: batch, date, cards, tokens per card (thousands), audit error rate, kB per card, CI result. */
export function formatRow({ batch, cards, tokens, auditTotal, auditWrong, kbPerCard, ci }, date) {
  const rate = auditTotal ? `${((100 * auditWrong) / auditTotal).toFixed(1)} % (${auditWrong}/${auditTotal})` : 'n/a';
  return `| ${[batch, date, cards, `${Math.round(tokens / cards / 1000)} k`, rate, kbPerCard, ci].join(' | ')} |`;
}

/** The text with `row` in the metrics table: replacing the row of the same batch, else after the last row, or in a new table, under a new heading if need be. */
export function appendRow(markdown, row) {
  const lines = markdown.trimEnd().split('\n');
  let start = lines.findIndex((line) => line.trim() === HEADING);
  if (start < 0) {
    lines.push('', HEADING, '');
    start = lines.length - 2;
  }
  let end = lines.findIndex((line, i) => i > start && /^#{1,2} /.test(line)); // the next section
  if (end < 0) end = lines.length;
  const batch = row.split('|')[1].trim();
  const same = lines.findIndex((line, i) => i > start && i < end && line.startsWith('|') && line.split('|')[1]?.trim() === batch);
  if (same >= 0) {
    lines[same] = row;
    return `${lines.join('\n')}\n`;
  }
  const last = lines.findLastIndex((line, i) => i > start && i < end && line.startsWith('|'));
  if (last < 0) lines.splice(end, 0, ...HEADER, row, ...(end < lines.length ? [''] : []));
  else lines.splice(last + 1, 0, row);
  return `${lines.join('\n')}\n`;
}

function main(args, now = new Date()) {
  const fail = (message) => {
    console.error(`metrics: ${message}`);
    process.exit(2);
  };
  let metrics;
  let file;
  try {
    metrics = parseArgs(args);
    file = optionValue(args, '--file') ?? join(ROOT, 'docs/PROGRESS.md');
  } catch (error) {
    return fail(error.message);
  }
  const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const row = formatRow(metrics, date);
  try {
    writeFileSync(file, appendRow(readFileSync(file, 'utf8'), row));
  } catch (error) {
    return fail(`cannot read or write ${file}: ${error.code ?? error.message}`);
  }
  console.log(row);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main(process.argv.slice(2));
