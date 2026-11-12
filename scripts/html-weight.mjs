#!/usr/bin/env node
/**
 * HTML weight report (plan I-6): `node scripts/html-weight.mjs [dist]`.
 * Prints the size of the built HTML per page kind and, for the three heaviest
 * entity pages, what their bytes are made of. 1 kB = 1000 bytes.
 *
 * shortcut: regex extraction, fine for Astro's own well-formed output. The
 * parts are cut out in order, so they never overlap; what is left is tags and text.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const KINDS = [
  ['entity', /^(it|en)\/e\/[^/]+\/index\.html$/],
  ['pattern', /^(it|en)\/pattern\//],
  ['pathway', /^(it|en)\/pathways\//],
  ['atlas', /^(it|en)\/atlas\//],
  ['home', /^((it|en)\/)?index\.html$/],
];
const kB = (n) => (n / 1000).toFixed(1);
const bytes = (s) => Buffer.byteLength(s);
const attrKey = (n) => (n === 'class' || n === 'href' ? n : n === 'style' ? 'style=' : /^data-/.test(n) ? 'data-*' : /^aria-/.test(n) ? 'aria-*' : 'other');

/** Cut the named parts out of one page, then split the rest into text, tags and attributes. */
export function breakdown(html) {
  const parts = {};
  let rest = html;
  const cut = (name, re) => {
    parts[name] = [...rest.matchAll(re)].reduce((n, m) => n + bytes(m[0]), 0);
    rest = rest.replace(re, '');
  };
  cut('first notice', /<section\b[^>]*\bdata-first-notice\b[\s\S]*?<\/section>/g);
  cut('templates', /<template\b[\s\S]*?<\/template>/g);
  cut('claim comments', /<!--c:[\s\S]*?-->/g);
  cut('other comments', /<!--[\s\S]*?-->/g);
  cut('style blocks', /<style\b[\s\S]*?<\/style>/g);
  cut('scripts', /<script\b[\s\S]*?<\/script>/g);
  const text = bytes(rest.replace(/<[^>]*>/g, ''));
  const attrs = { class: 0, href: 0, 'data-*': 0, 'aria-*': 0, 'style=': 0, other: 0 };
  for (const tag of rest.matchAll(/<[a-z][^>]*>/gi))
    for (const a of tag[0].matchAll(/\s([\w:.-]+)(?:="[^"]*")?/g)) attrs[attrKey(a[1])] += bytes(a[0]);
  return { total: bytes(html), parts: { text, 'tags+attrs': bytes(rest) - text, ...parts }, attrs };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dist = process.argv[2] ?? 'dist';
  const pages = readdirSync(dist, { recursive: true })
    .filter((f) => f.endsWith('.html'))
    .map((f) => ({ f: f.split('\\').join('/'), html: readFileSync(join(dist, f), 'utf8') }));
  const kindOf = (f) => KINDS.find(([, re]) => re.test(f))?.[0] ?? 'other';
  console.log('kind       pages     min kB  median kB     max kB   total MB');
  for (const kind of [...KINDS.map(([k]) => k), 'other']) {
    const sizes = pages.filter((p) => kindOf(p.f) === kind).map((p) => bytes(p.html)).sort((a, b) => a - b);
    if (!sizes.length) continue;
    const total = sizes.reduce((a, b) => a + b, 0) / 1e6;
    console.log(`${kind.padEnd(10)} ${String(sizes.length).padStart(5)} ${[sizes[0], sizes[sizes.length >> 1], sizes.at(-1)].map((n) => kB(n).padStart(10)).join(' ')} ${total.toFixed(2).padStart(10)}`);
  }
  const heaviest = pages.filter((p) => kindOf(p.f) === 'entity').sort((a, b) => bytes(b.html) - bytes(a.html)).slice(0, 3);
  for (const p of heaviest) {
    const { total, parts, attrs } = breakdown(p.html);
    const row = (o) => Object.entries(o).map(([k, v]) => `${k} ${kB(v)}`).join(' | ');
    console.log(`\n${p.f}: ${kB(total)} kB\n  ${row(parts)}\n  attributes (inside tags+attrs): ${row(attrs)}`);
  }
}
