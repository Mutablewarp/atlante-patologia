/**
 * Per-entity view of the content gates (tests/content/gates.ts), selected by env ENTITY:
 *   npm run validate:entity -- <id>        (wrapper: scripts/validate-entity.mjs)
 *   ENTITY=<id> npx vitest run tests/content-one
 * Runs every gate on the real tree and keeps the problems of that entity's folder
 * and claim ledger, so authors get the same verdict as `npm test` for one card.
 * Skipped when ENTITY is unset, so `npm test` is unaffected.
 */
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { runGates } from '../content/gates.ts';
import { loadTree } from '../content/tree.ts';

const ENTITY = process.env.ENTITY?.trim().replace(/^_/, '') ?? '';

describe.skipIf(!ENTITY)(`content gates for entity "${ENTITY}"`, () => {
  const tree = loadTree(fileURLToPath(new URL('../../', import.meta.url)));
  const unit = tree.entities.find((u) => u.id === ENTITY);

  it('folder exists', () => expect(unit, `no src/content/entities/${ENTITY}/`).toBeDefined());

  it('passes every gate', () => {
    const { problems, stale } = runGates(tree);
    const mine = (file: string) => (unit && file.startsWith(`${unit.dir}/`)) || file === `docs/ledger/${ENTITY}.yaml`;
    expect(problems.filter((p) => mine(p.file)).map((p) => `[${p.gate}] ${p.file}: ${p.message}`)).toEqual([]);
    for (const s of stale.filter((x) => mine(x.file))) console.warn(`stale translation: ${s.file} (translatedFrom should be ${s.expected})`);
  });
});
