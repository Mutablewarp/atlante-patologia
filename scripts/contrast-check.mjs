#!/usr/bin/env node
// WCAG 2.2 contrast gate for the design tokens (src/styles/tokens.css).
// Parses `--token: light-dark(#light, #dark);` and checks every foreground/
// background pair the stylesheets use, in both themes. Exit 1 below threshold.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const TEXT = 4.5; // SC 1.4.3 normal text
const UI = 3; // SC 1.4.11 non-text (borders, focus, indicators) and large text

/** [foreground, background, minimum, what] — keep in sync with the CSS. */
export const PAIRS = [
  ['ink', 'paper', TEXT, 'body text'],
  ['ink', 'surface', TEXT, 'text on cards'],
  ['ink', 'surface-2', TEXT, 'text on chips / sunken areas'],
  ['ink-muted', 'paper', TEXT, 'secondary text'],
  ['ink-muted', 'surface', TEXT, 'secondary text on cards'],
  ['ink-muted', 'surface-2', TEXT, 'secondary text on chips'],
  ['hema', 'paper', TEXT, 'links'],
  ['hema', 'surface', TEXT, 'links on cards'],
  ['hema-ink', 'hema-soft', TEXT, 'current nav label / hema chips'],
  ['ink', 'hema-soft', TEXT, 'text on hema tint'],
  ['on-hema', 'hema', TEXT, 'primary button text'],
  ['eosin-ink', 'eosin-soft', TEXT, 'eosin badge text'],
  ['eosin', 'paper', TEXT, 'eosin accent text (kicker labels)'],
  ['eosin', 'surface', TEXT, 'eosin accent text on cards'],
  ['caution-ink', 'caution-bg', TEXT, 'draft / caution banner'],
  ['border-strong', 'paper', UI, 'control borders'],
  ['border-strong', 'surface', UI, 'control borders on cards'],
  ['focus', 'paper', UI, 'focus ring'],
  ['focus', 'surface', UI, 'focus ring on cards'],
  ['focus', 'surface-2', UI, 'focus ring on chips'],
  ['eosin', 'surface', UI, 'nav indicator bar'],
  ['hema', 'hema-soft', UI, 'current nav icon on indicator'],
];

export function parseTokens(css) {
  const tokens = {};
  const re = /--([a-z0-9-]+):\s*light-dark\(\s*(#[0-9a-f]{6})\s*,\s*(#[0-9a-f]{6})\s*\)/gi;
  for (const [, name, light, dark] of css.matchAll(re)) tokens[name] = { light, dark };
  return tokens;
}

function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

function main() {
  const css = readFileSync(fileURLToPath(new URL('../src/styles/tokens.css', import.meta.url)), 'utf8');
  const tokens = parseTokens(css);
  let failures = 0;
  for (const theme of ['light', 'dark']) {
    console.log(`\n${theme.toUpperCase()}`);
    for (const [fg, bg, min, what] of PAIRS) {
      if (!tokens[fg] || !tokens[bg]) {
        console.log(`  MISSING  ${fg} on ${bg}`);
        failures++;
        continue;
      }
      const ratio = contrast(tokens[fg][theme], tokens[bg][theme]);
      const ok = ratio >= min;
      if (!ok) failures++;
      console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${ratio.toFixed(2).padStart(5)} >= ${min}  ${fg} on ${bg} (${what})`);
    }
  }
  if (failures) {
    console.error(`\ncontrast-check: ${failures} pair(s) below WCAG 2.2 AA thresholds`);
    process.exit(1);
  }
  console.log(`\ncontrast-check: all ${PAIRS.length * 2} pairs pass`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
