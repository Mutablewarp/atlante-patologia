#!/usr/bin/env node
// Fast per-entity validator (no Astro build), safe to run concurrently.
// Usage: npm run validate:entity -- <entity-id>      e.g. npm run validate:entity -- coagulative-necrosis
// Runs tests/content-one/entity.test.ts with ENTITY=<id>. Exit code = vitest exit code.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const id = process.argv[2] ?? '';
if (!/^_?[a-z0-9]+(-[a-z0-9]+)*$/.test(id)) {
  console.error('Usage: npm run validate:entity -- <entity-id>   (lowercase-kebab-case id)');
  process.exit(2);
}
const root = fileURLToPath(new URL('..', import.meta.url));
const vitest = fileURLToPath(new URL('../node_modules/vitest/vitest.mjs', import.meta.url));
const r = spawnSync(process.execPath, [vitest, 'run', 'tests/content-one'], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, ENTITY: id },
});
process.exit(r.status ?? 1);
