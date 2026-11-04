import { describe, expect, it } from 'vitest';
import { classificationView, editionLabel } from '../src/lib/classification.ts';
import type { Source } from '../src/lib/schema.ts';

const ev = { via: 'publisher' as const, date: new Date('2026-11-03') };
const src = (s: Partial<Source> & { id: string }): Source =>
  ({ title: s.id, year: 2026, kind: 'standard', series: 'WHO Classification of Tumours', existsVerified: ev, ...s }) as Source;
const checked = new Date('2026-11-03');

describe('classificationView', () => {
  const five = src({ id: 'v5', edition: 5, volume: 2, year: 2019, status: 'print' });
  it('returns nothing without a block or with an unknown source', () => {
    expect(classificationView(undefined, [five])).toBeUndefined();
    expect(classificationView({ source: 'ghost', checked }, [five])).toBeUndefined();
  });
  it('takes the volume from the source unless the block overrides it; no notice without a successor', () => {
    expect(classificationView({ source: 'v5', checked }, [five])).toEqual({ source: five, volume: 2, checked, newer: undefined });
    expect(classificationView({ source: 'v5', volume: 9, checked }, [five])!.volume).toBe(9);
  });
  it('announces a print or online-beta successor, never a forthcoming one', () => {
    for (const status of ['print', 'online-beta'] as const)
      expect(classificationView({ source: 'v5', checked }, [five, src({ id: 'v6', edition: 6, supersedes: 'v5', status })])!.newer?.id).toBe('v6');
    expect(classificationView({ source: 'v5', checked }, [five, src({ id: 'v6', edition: 6, supersedes: 'v5', status: 'forthcoming' })])!.newer).toBeUndefined();
  });
  it('follows the supersedes chain to the newest available edition and stops on a cycle', () => {
    const six = src({ id: 'v6', edition: 6, supersedes: 'v5', status: 'print' });
    const seven = src({ id: 'v7', edition: 7, supersedes: 'v6', status: 'online-beta' });
    expect(classificationView({ source: 'v5', checked }, [five, six, seven])!.newer?.id).toBe('v7');
    const a = src({ id: 'a', supersedes: 'b', status: 'print' });
    const b = src({ id: 'b', supersedes: 'a', status: 'print' });
    expect(classificationView({ source: 'a', checked }, [a, b])!.newer).toBeDefined();
  });
});

describe('editionLabel', () => {
  it('uses the Italian ª and English ordinals', () => {
    expect(editionLabel('it', 5)).toBe('5ª ed.');
    const n = [1, 2, 3, 4, 11, 12, 13, 21];
    expect(n.map((x) => editionLabel('en', x))).toEqual(['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st'].map((s) => `${s} ed.`));
  });
});
