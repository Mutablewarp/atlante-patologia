// Card manifest (scripts/agent/manifest.mjs): the programme-map table parser on a handwritten fixture, and the checks.
// The map itself is private, so the test on the real file runs only on the owner's machine.
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseProgramme, problems, summary } from '../scripts/agent/manifest.mjs';

const MAP = `
| \`id\` | kebab-case, American spelling | not a card row: the legend of the columns, before any block |

### B03 Cardiovascular — o17 — 2 cards

| id | IT | EN | kind | tier | Rubin pp. | P | mod | prog | batch | must cover |
|---|---|---|---|---|---|---|---|---|---|---|
| \`myocardial-infarction\` ★ | Infarto miocardico | Myocardial infarction | disease | core | 655–662 | P0 | o17 | C1 | W04 | transmural vs subendocardial; dating; complications |
| \`cardiac-amyloidosis\` | Amiloidosi cardiaca | Cardiac amyloidosis | disease | extended | 683 | P1 ⚠ | o17 | [C3] | W04 | Congo red; restrictive pattern |

### B04 Respiratory — o18 — 1 card

| id | IT | EN | kind | tier | Rubin pp. | P | mod | prog | batch | must cover |
|---|---|---|---|---|---|---|---|---|---|---|
| \`pulmonary-embolism\` | Embolia polmonare | Pulmonary embolism | process | core | scattered | P0 | o18 | R2 | W05 | sources of emboli |
`;

describe('parseProgramme', () => {
  const rows = parseProgramme(MAP);

  it('reads one row per card and skips the legend', () => {
    expect(rows.map((r: { id: string }) => r.id)).toEqual(['myocardial-infarction', 'cardiac-amyloidosis', 'pulmonary-embolism']);
  });

  it('reads the flags and cells', () => {
    expect(rows[0]).toMatchObject({
      planned: true,
      editionDependent: false,
      block: 'B03',
      kind: 'disease',
      tier: 'core',
      pages: '655–662',
      priority: 'P0',
      module: 'o17',
      batch: 'W04',
      names: { it: 'Infarto miocardico', en: 'Myocardial infarction' },
      mustCover: ['transmural vs subendocardial', 'dating', 'complications'],
    });
    expect(rows[1]).toMatchObject({ planned: false, editionDependent: true, priority: 'P1', prog: '[C3]' });
    expect(rows[2].block).toBe('B04');
  });

  it('throws on a row with the wrong number of cells', () => {
    expect(() => parseProgramme('### B01 X\n| `a-b` | A | B | disease | core | 1 | P0 | g10 | M1 | W01 |')).toThrow(/expected 11 cells/);
  });
});

describe('problems', () => {
  const rows = parseProgramme(MAP);

  it('accepts a clean manifest', () => {
    expect(problems(rows, { modules: new Set(['o17', 'o18']) })).toEqual([]);
  });

  it('reports duplicates, unknown values and unknown modules', () => {
    const bad = [...rows, { ...rows[0] }, { ...rows[1], id: 'x', kind: 'tumor', batch: 'W4' }];
    const out = problems(bad, { modules: new Set(['o17']) });
    expect(out).toContain('duplicate id myocardial-infarction');
    expect(out).toContain('x: kind "tumor"');
    expect(out).toContain('x: batch "W4"');
    expect(out).toContain('pulmonary-embolism: module "o18" is not in modules.yaml');
  });
});

describe('summary', () => {
  it('counts cards per batch, block and priority', () => {
    expect(summary(parseProgramme(MAP))).toEqual({
      cards: 3,
      perBatch: { W04: 2, W05: 1 },
      perBlock: { B03: 2, B04: 1 },
      perPriority: { P0: 2, P1: 1 },
    });
  });
});

const REAL = fileURLToPath(new URL('../private/research/programme-entities.md', import.meta.url));
describe.skipIf(!existsSync(REAL))('the real programme map (owner machine only)', () => {
  // 378 cards of the course programme in W01–W19, plus 89 outside it in W20–W24 (block B16, added 2026-11-13 so that every module has cards).
  it('has 467 unique cards in 24 batches, with the planned ★ ids', () => {
    const rows = parseProgramme(readFileSync(REAL, 'utf8'));
    expect(rows).toHaveLength(467);
    expect(new Set(rows.map((r: { id: string }) => r.id)).size).toBe(467);
    expect(new Set(rows.map((r: { batch: string }) => r.batch)).size).toBe(24);
    expect(rows.filter((r: { planned: boolean }) => r.planned)).toHaveLength(36);
    expect(problems(rows, { modules: new Set(rows.map((r: { module: string }) => r.module)) })).toEqual([]);
  });
});
