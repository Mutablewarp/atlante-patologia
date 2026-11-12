#!/usr/bin/env node
/**
 * Numbers check (plan I-10): the numbers in a card's ledger statements that are not on the pages the claim cites. Advisory.
 *
 *   node scripts/agent/numbers-check.mjs <id>
 *
 * Reads docs/ledger/<id>.yaml and .work/packets/<id>/source.txt (pages marked `[p. N]`, printed numbers). Only each claim's
 * `statement` is read, so claim ids, page locators and dates are never counted. `checked` counts numbers; a claim whose
 * cited pages are not in source.txt is not checked and is counted in `skippedClaims`. Prints JSON of at most 30 lines and
 * always exits 0.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const MAX_SHOWN = 20;

/** The numbers of a text as written: integers, decimals, thousands (1,000), percentages; both ends of a range. Once each. */
export function numbersIn(text) {
  return [...new Set(String(text ?? '').match(/\d+(?:,\d{3})*(?:\.\d+)?/g) ?? [])];
}

/** Same value, same key: "1,000" and "1000", "0.50" and "0.5". */
const key = (number) => String(Number(number.replace(/,/g, '')));

/** The printed pages named in the free text of `pages`: "41, 45-46 (ch. 2)" gives 41, 45, 46. */
export function citedPages(pages) {
  const out = [];
  for (const [, from, to] of String(pages ?? '').replace(/\([^)]*\)/g, ' ').matchAll(/(\d+)(?:\s*[-–—]\s*(\d+))?/g)) {
    const first = Number(from);
    for (let page = first; page <= Math.max(first, Math.min(Number(to ?? from), first + 60)); page += 1) out.push(page);
  }
  return out;
}

/** The text of each printed page of source.txt, by page number. */
export function sourcePages(text) {
  const parts = text.replace(/^\[truncated:.*\]\s*$/m, '').split(/^\[p\. (\d+)\]\s*$/m);
  const pages = new Map();
  for (let i = 1; i < parts.length; i += 2) pages.set(Number(parts[i]), `${pages.get(Number(parts[i])) ?? ''}${parts[i + 1]}`);
  return pages;
}

/** Compares the statements of a ledger (YAML text) with the pages of source.txt: { checked, skippedClaims, notFound }. */
export function checkNumbers(ledgerYaml, sourceText) {
  const keys = new Map([...sourcePages(sourceText)].map(([page, text]) => [page, new Set(numbersIn(text).map(key))]));
  const notFound = [];
  let checked = 0;
  let skippedClaims = 0;
  for (const claim of parse(ledgerYaml)?.claims ?? []) {
    const numbers = numbersIn(claim.statement);
    const cited = citedPages(claim.sourceRef?.pages).filter((page) => keys.has(page));
    if (!numbers.length) continue;
    if (!cited.length) {
      skippedClaims += 1;
      continue;
    }
    for (const number of numbers) {
      checked += 1;
      if (!cited.some((page) => keys.get(page).has(key(number)))) notFound.push({ claim: claim.claimId, number });
    }
  }
  return { checked, skippedClaims, notFound };
}

/**
 * The result of one card from the files under `root`. Never throws: a problem becomes a `note`.
 * @returns {{ id: string, checked: number, skippedClaims: number, notFound: { claim: string, number: string }[], note?: string }}
 */
export function run(id, root = ROOT) {
  const empty = { id, checked: 0, skippedClaims: 0, notFound: [] };
  if (!/^_?[a-z0-9]+(-[a-z0-9]+)*$/.test(id ?? '')) return { ...empty, note: 'usage: numbers-check.mjs <card id>' };
  const ledger = join(root, 'docs/ledger', `${id}.yaml`);
  const source = join(root, '.work/packets', id, 'source.txt');
  for (const file of [ledger, source]) if (!existsSync(file)) return { ...empty, note: `${relative(root, file)} not found` };
  try {
    return { id, ...checkNumbers(readFileSync(ledger, 'utf8'), readFileSync(source, 'utf8')) };
  } catch (error) {
    return { ...empty, note: String(error.message).slice(0, 120) };
  }
}

/** The result as JSON in at most 30 lines: one row per number, the first 20, and `more` for the rest. */
export function render({ notFound, ...head }) {
  const shown = notFound.slice(0, MAX_SHOWN);
  const more = notFound.length > shown.length ? { more: notFound.length - shown.length } : {};
  const rows = shown.map((entry) => `  ${JSON.stringify(entry)}`).join(',\n');
  return `{${JSON.stringify({ ...head, ...more }).slice(1, -1)},\n "notFound": [${rows && `\n${rows}\n `}]\n}`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) console.log(render(run(process.argv[2])));
