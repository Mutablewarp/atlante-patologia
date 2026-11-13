// Module status (scripts/agent/module-status.mjs): a module is published when its planned list is empty and a card is published.
import { describe, expect, it } from 'vitest';
import { applyStatus, moduleLines } from '../scripts/agent/module-status.mjs';

const MODULES = `# header comment
- id: full
  status: planned
  names: { it: "Una riga molto lunga che il default di yaml andrebbe a capo se non fosse per lineWidth zero ok", en: "x" }
- id: partial
  status: planned
  planned:
    - id: waiting
      names: { it: "Attesa", en: "Waiting" }
- id: empty
  status: planned
- id: kept
  status: published
  planned:
    - id: late
      names: { it: "Tardi", en: "Late" }
`;

const COUNTS = new Map([
  ['full', 2],
  ['partial', 1],
  ['kept', 1],
]);

describe('module status', () => {
  it('flips a complete module and no other', () => {
    const { text, flipped } = applyStatus(MODULES, COUNTS);
    expect(flipped).toEqual(['full']);
    expect(text).toContain('- id: full\n  status: published');
    expect(text).toContain('- id: partial\n  status: planned');
    expect(text).toContain('- id: empty\n  status: planned');
  });

  it('does not flip a partial module', () => {
    expect(applyStatus(MODULES, COUNTS).flipped).not.toContain('partial');
  });

  it('does not flip a module without published cards', () => {
    expect(applyStatus(MODULES, COUNTS).flipped).not.toContain('empty');
  });

  it('keeps a published module published, even with planned entries left', () => {
    const { text, flipped } = applyStatus(MODULES, COUNTS);
    expect(flipped).not.toContain('kept');
    expect(text).toContain('- id: kept\n  status: published');
  });

  it('keeps comments and long lines, and leaves the text alone when nothing flips', () => {
    const { text } = applyStatus(MODULES, COUNTS);
    expect(text.startsWith('# header comment\n')).toBe(true);
    expect(text).toContain('Una riga molto lunga che il default di yaml andrebbe a capo se non fosse per lineWidth zero ok');
    const none = applyStatus(MODULES, new Map());
    expect(none.changed).toBe(false);
    expect(none.text).toBe(MODULES);
  });

  it('prints one line per module', () => {
    const lines = moduleLines(
      [
        { id: 'full', status: 'planned' },
        { id: 'partial', status: 'planned', planned: [{ id: 'waiting' }] },
      ],
      COUNTS,
    );
    expect(lines).toEqual(['full: 2 published, 0 planned, planned -> published', 'partial: 1 published, 1 planned, planned']);
  });
});
