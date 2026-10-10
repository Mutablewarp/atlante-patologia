import { describe, expect, it } from 'vitest';
import { buildRelationIndex, contradictoryPairs } from '../src/lib/relations.ts';

describe('relation graph', () => {
  const entities = [
    { id: 'a', relations: [{ type: 'differentialOf' as const, target: 'b' }, { type: 'causes' as const, target: 'c' }] },
    { id: 'b', relations: [{ type: 'differentialOf' as const, target: 'a' }] }, // declared on both sides
    { id: 'c', relations: [] },
  ];
  const index = buildRelationIndex(entities);

  it('mirrors symmetric relations without duplicates', () => {
    const b = index.get('b')!;
    expect(b).toHaveLength(1);
    expect(b[0]).toMatchObject({ type: 'differentialOf', direction: 'forward' });
    expect(b[0]!.items.map((i) => i.target)).toEqual(['a']);
    expect(index.get('a')!.find((g) => g.type === 'differentialOf')!.items).toHaveLength(1);
  });

  it('gives directed relations an inverse label on the target', () => {
    const c = index.get('c')!;
    expect(c).toEqual([
      expect.objectContaining({ type: 'causes', direction: 'inverse', items: [{ target: 'a', note: undefined }] }),
    ]);
    expect(c[0]!.label.en).toBe('Caused by');
    expect(c[0]!.label.it).toBe('Causato da');
    expect(index.get('a')!.find((g) => g.type === 'causes')!.label.en).toBe('Causes');
  });

  it('includes relations to unpublished targets so they can render as planned', () => {
    const idx = buildRelationIndex([{ id: 'x', relations: [{ type: 'mimics', target: 'ghost' }] }]);
    expect(idx.get('ghost')![0]!.label.en).toBe('Can be mimicked by');
  });

  it('detects contradictory directed pairs', () => {
    expect(
      contradictoryPairs([
        { id: 'a', relations: [{ type: 'causes', target: 'b' }] },
        { id: 'b', relations: [{ type: 'causes', target: 'a' }] },
      ]),
    ).toHaveLength(1);
    expect(contradictoryPairs(entities)).toEqual([]);
  });
});
