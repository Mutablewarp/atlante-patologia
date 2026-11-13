/**
 * Per-entity view of the content gates (tests/content/gates.ts), selected by env ENTITY:
 *   npm run validate:entity -- <id>        (wrapper: scripts/validate-entity.mjs)
 *   ENTITY=<id> npx vitest run tests/content-one
 * Runs every gate on the real tree and keeps the problems of that entity's folder
 * and claim ledger, so authors get the same verdict as `npm test` for one card.
 * Skipped when ENTITY is unset, so `npm test` is unaffected.
 */
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { runGates } from '../content/gates.ts';
import { loadTree } from '../content/tree.ts';

const ENTITY = process.env.ENTITY?.trim().replace(/^_/, '') ?? '';

describe.skipIf(!ENTITY)(`content gates for entity "${ENTITY}"`, () => {
  const tree = loadTree(fileURLToPath(new URL('../../', import.meta.url)));
  // scripts/agent: the new sources an agent found are a fragment (.work/fragments/<id>/sources.yaml) until finalize-batch merges
  // them into src/content/sources.yaml; EXTRA_SOURCES adds them here, in memory, so the card can be checked before that.
  const extraPath = process.env.EXTRA_SOURCES;
  if (extraPath && existsSync(extraPath)) {
    const extra = parse(readFileSync(extraPath, 'utf8'));
    const known = new Set((tree.sources.data as { id: string }[]).map((s) => s.id));
    if (Array.isArray(extra)) (tree.sources.data as unknown[]).push(...extra.filter((s) => s && !known.has(s.id)));
  }
  const unit = tree.entities.find((u) => u.id === ENTITY);

  it('folder exists', () => expect(unit, `no src/content/entities/${ENTITY}/`).toBeDefined());

  it('passes every gate', () => {
    const { problems, stale } = runGates(tree);
    const mine = (file: string) => (unit && file.startsWith(`${unit.dir}/`)) || file === `docs/ledger/${ENTITY}.yaml`;
    expect(problems.filter((p) => mine(p.file)).map((p) => `[${p.gate}] ${p.file}: ${p.message}`)).toEqual([]);
    for (const s of stale.filter((x) => mine(x.file))) console.warn(`stale translation: ${s.file} (translatedFrom should be ${s.expected})`);
  });
});
