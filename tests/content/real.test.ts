// Content gates on the REAL src/content tree (docs/CONTENT_GATES.md). Any problem fails the suite.
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { runGates, type Gate } from './gates.ts';
import { loadTree } from './tree.ts';

const root = fileURLToPath(new URL('../../', import.meta.url));
const { problems, stale } = runGates(loadTree(root));
const fmt = (gate: Gate) => problems.filter((p) => p.gate === gate).map((p) => `${p.file}: ${p.message}`);

describe('content gates on src/content', () => {
  for (const gate of ['schema', 'parity', 'ledger', 'numbers', 'references', 'review', 'images'] as const)
    it(`${gate} gate passes`, () => expect(fmt(gate)).toEqual([]));

  it('writes stale translations to reports/translation-stale.json (warning, not a failure)', () => {
    mkdirSync(`${root}reports`, { recursive: true });
    writeFileSync(`${root}reports/translation-stale.json`, `${JSON.stringify({ generated: new Date().toISOString(), stale }, null, 2)}\n`);
    if (stale.length) console.warn(`translation-stale: ${stale.length} it.md file(s) out of date — see reports/translation-stale.json`);
  });
});
