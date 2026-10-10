#!/usr/bin/env node
// Dependency license ledger (COMPLIANCE_PLAN §2 item 1).
//
//   npm run licenses
//
// Writes docs/licenses/dependencies.json (name, version, license, repository,
// production/development) and exits 1 when a package's license is outside the
// allowlist and not covered by a documented exception below.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { init } from 'license-checker-rseidelsohn';

export const ALLOW = new Set([
  'MIT',
  'ISC',
  'BSD-2-Clause',
  'BSD-3-Clause',
  'Apache-2.0',
  '0BSD',
  'CC0-1.0',
  'BlueOak-1.0.0',
  'OFL-1.1', // self-hosted fonts (Fontsource)
]);

// Packages outside the allowlist that never reach the published site. Each
// needs a reason; the ledger README repeats them. Matched by package name.
export const EXCEPTIONS = [
  { name: /^(@axe-core\/playwright|axe-core)$/, license: 'MPL-2.0', reason: 'Accessibility tests only (Playwright); never bundled or published.' },
  { name: /^lightningcss(-[a-z0-9-]+)?$/, license: 'MPL-2.0', reason: 'CSS minifier run by Vite at build time; its code is not part of the output.' },
  { name: /^caniuse-lite$/, license: 'CC-BY-4.0', reason: 'Browser-support data read by browserslist at build time; not published.' },
  { name: /^@img\/sharp-libvips-/, license: 'LGPL-3.0-or-later', reason: 'libvips binary loaded by sharp during the build (dynamic linking, unmodified); not published.' },
  { name: /^@img\/sharp-wasm32$/, license: 'Apache-2.0 AND LGPL-3.0-or-later AND MIT', reason: 'Optional WebAssembly build of sharp/libvips for the build step; not published.' },
  { name: /^spdx-(exceptions|ranges)$/, license: /CC-BY-3\.0/, reason: 'SPDX data used by the license checker itself; development only.' },
];

/**
 * Does an SPDX expression satisfy the allowlist? OR needs one side, AND needs both.
 * shortcut: no nested parentheses; fine for every expression in our tree today.
 */
export function allowed(expr) {
  const e = expr.replace(/\*$/, '').trim(); // "*" = guessed from the license file
  const unwrapped = /^\((.*)\)$/.test(e) ? e.slice(1, -1) : e;
  if (/ OR /.test(unwrapped)) return unwrapped.split(/ OR /).some((x) => allowed(x));
  if (/ AND /.test(unwrapped)) return unwrapped.split(/ AND /).every((x) => allowed(x));
  return ALLOW.has(unwrapped);
}

export function exceptionFor(name, license) {
  return EXCEPTIONS.find((x) => x.name.test(name) && (x.license instanceof RegExp ? x.license.test(license) : x.license === license));
}

const scan = (opts) =>
  new Promise((resolve, reject) => init({ start: process.cwd(), ...opts }, (err, res) => (err ? reject(err) : resolve(res))));

function split(key) {
  const at = key.lastIndexOf('@');
  return [key.slice(0, at), key.slice(at + 1)];
}

async function main() {
  const self = JSON.parse(readFileSync('package.json', 'utf8')).name;
  const [all, prod] = await Promise.all([scan({}), scan({ production: true })]);
  const packages = [];
  const problems = [];
  for (const [key, info] of Object.entries(all).sort(([a], [b]) => a.localeCompare(b))) {
    const [name, version] = split(key);
    if (name === self) continue;
    const license = Array.isArray(info.licenses) ? info.licenses.join(' OR ') : (info.licenses ?? 'UNKNOWN');
    const scope = key in prod ? 'production' : 'development';
    const entry = { name, version, license, repository: info.repository ?? null, scope };
    if (!allowed(license)) {
      const ex = exceptionFor(name, license);
      if (ex) entry.exception = ex.reason;
      else problems.push(`${key}: ${license} (${scope})`);
    }
    packages.push(entry);
  }
  const ledger = {
    generated: new Date().toISOString().slice(0, 10),
    tool: 'license-checker-rseidelsohn 5.0.1',
    platform: `${process.platform}-${process.arch}`, // optional native packages differ by platform
    allowlist: [...ALLOW],
    total: packages.length,
    exceptions: packages.filter((p) => p.exception).map((p) => `${p.name}@${p.version}`),
    packages,
  };
  mkdirSync('docs/licenses', { recursive: true });
  writeFileSync('docs/licenses/dependencies.json', `${JSON.stringify(ledger, null, 2)}\n`);
  console.log(`${packages.length} packages, ${ledger.exceptions.length} documented exceptions → docs/licenses/dependencies.json`);
  if (problems.length) {
    console.error(`License not on the allowlist (add an exception with a reason only if it is never published):\n  ${problems.join('\n  ')}`);
    process.exit(1);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
