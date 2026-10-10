import { describe, expect, it } from 'vitest';
import type { LensId } from '../src/lib/schema.ts';
import { lensMembership, nonEmptyLensCount, prevNext, primaryTerm, unknownTerms } from '../src/lib/lenses.ts';

const empty: Record<string, string[]> = { system: [], process: [], pattern: [], presentation: [], marker: [], group: [] };
const e = (id: string, module: string, en: string, lenses: Record<string, string[]>) => ({
  id,
  module,
  names: { it: en, en },
  lenses: { ...empty, ...lenses } as Record<LensId, string[]>,
});
const order = new Map([
  ['g01', 1],
  ['o17', 17],
]);

describe('lens membership', () => {
  const list = [
    e('heart-x', 'o17', 'Alpha', { system: ['heart'], group: ['vascular'] }),
    e('cell-b', 'g01', 'Beta', { system: ['general'], process: ['cell-death'], group: ['degenerative'] }),
    e('cell-a', 'g01', 'Zeta', { system: ['general', 'heart'], group: ['degenerative'] }),
  ];
  const m = lensMembership(list, order);

  it('groups entities by lens term in syllabus order (module, then name)', () => {
    expect(m.get('system')!.get('general')).toEqual(['cell-b', 'cell-a']);
    expect(m.get('system')!.get('heart')).toEqual(['cell-a', 'heart-x']);
    expect(m.get('process')!.get('cell-death')).toEqual(['cell-b']);
    expect(m.get('marker')!.size).toBe(0);
  });

  it('counts non-empty lenses and picks the primary organ-system term', () => {
    expect(nonEmptyLensCount(list[1]!)).toBe(3);
    expect(primaryTerm(list[2]!)).toEqual({ lens: 'system', term: 'general' });
  });

  it('computes prev/next within a term', () => {
    expect(prevNext(['a', 'b', 'c'], 'b')).toEqual({ prev: 'a', next: 'c' });
    expect(prevNext(['a'], 'a')).toEqual({ prev: undefined, next: undefined });
    expect(prevNext(['a'], 'zzz')).toEqual({});
  });

  it('reports terms missing from the taxonomy', () => {
    const tax = new Map([['system' as const, new Set(['general'])]]);
    expect(unknownTerms([list[0]!], tax)).toContain('heart-x: system/heart');
  });
});
