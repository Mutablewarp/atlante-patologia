// Planned lists (scripts/agent/sync-planned.mjs): the manifest against modules.yaml, on handwritten fixtures.
import { describe, expect, it } from 'vitest';
import { applyPlanned, planChanges } from '../scripts/agent/sync-planned.mjs';

const row = (id: string, module: string, kind = 'disease') => ({
  id,
  module,
  kind,
  names: { it: `${id}-it`, en: `${id}-en` },
});

const MODULES = `# header comment
- id: g01
  status: planned
  planned:
    - id: done-card   # trailing comment
      names: { it: "Fatta", en: "Done" }
    - id: outside
      names: { it: "Fuori", en: "Outside" }
    - id: waiting
      names: { it: "Attesa", en: "Waiting" }
- id: g02
  status: planned
`;

const ROWS = [
  row('done-card', 'g01'),
  row('waiting', 'g01'),
  row('fresh', 'g01'),
  row('other', 'g02'),
  row('a-pattern', 'g02', 'pattern'),
  row('lost', 'g99'),
];
const PUBLISHED = new Set(['done-card']);

describe('planChanges', () => {
  const changes = planChanges(
    [
      { id: 'g01', planned: [{ id: 'done-card' }, { id: 'outside' }, { id: 'waiting' }] },
      { id: 'g02' },
    ],
    ROWS,
    PUBLISHED,
  );

  it('adds unpublished manifest rows, in manifest order', () => {
    expect(changes.find((c: { module: string }) => c.module === 'g01')?.add.map((r: { id: string }) => r.id)).toEqual(['fresh']);
    expect(changes.find((c: { module: string }) => c.module === 'g02')?.add.map((r: { id: string }) => r.id)).toEqual(['other']);
  });

  it('removes a published card, keeps unknown ids and listed unpublished ones', () => {
    const g01 = changes.find((c: { module: string }) => c.module === 'g01');
    expect(g01?.remove).toEqual(['done-card']);
  });

  it('skips pattern rows and modules that are not in modules.yaml', () => {
    const ids = changes.flatMap((c: { add: { id: string }[] }) => c.add.map((r) => r.id));
    expect(ids).not.toContain('a-pattern');
    expect(ids).not.toContain('lost');
  });
});

describe('applyPlanned', () => {
  it('edits the yaml, keeping comments and order', () => {
    const { text, changed } = applyPlanned(MODULES, ROWS, PUBLISHED);
    expect(changed).toBe(true);
    expect(text).toContain('# header comment');
    expect(text).not.toContain('done-card');
    expect(text.indexOf('id: outside')).toBeLessThan(text.indexOf('id: waiting'));
    expect(text.indexOf('id: waiting')).toBeLessThan(text.indexOf('id: fresh'));
    expect(text).toContain('id: other');
    expect(text).toContain('en: "fresh-en"');
  });

  it('keeps long lines whole and writes new names in the quotes of the old ones', () => {
    const long = 'Lesione squamosa intraepiteliale della cervice con un nome molto lungo';
    const modules = `- id: g01\n  status: planned\n  planned:\n    - id: outside\n      names: { it: "${long}", en: "${long}, in English and well past eighty characters" }\n`;
    const rows = [{ id: 'fresh', module: 'g01', kind: 'disease', names: { it: `${long} (nuova)`, en: `${long} (new)` } }];
    const { text } = applyPlanned(modules, rows, new Set());
    expect(text.startsWith(modules)).toBe(true); // the old lines are untouched
    expect(text).toContain(`    - id: fresh\n      names: { it: "${long} (nuova)", en: "${long} (new)" }\n`);
  });

  it('is idempotent on a second run', () => {
    const first = applyPlanned(MODULES, ROWS, PUBLISHED);
    const second = applyPlanned(first.text, ROWS, PUBLISHED);
    expect(second.changed).toBe(false);
    expect(second.text).toBe(first.text);
  });

  it('reports no change when nothing differs', () => {
    expect(applyPlanned('- id: g01\n  status: planned\n', [], new Set()).changed).toBe(false);
  });
});
