import { describe, expect, it } from 'vitest';
import { chaptersOf } from '../src/lib/chapters.ts';

type Data = Parameters<typeof chaptersOf>[0];
const mod = (id: string, order: number, planned: number) => ({
  id,
  order,
  section: 'I' as const,
  label: { it: id, en: id },
  status: 'planned' as const,
  planned: Array.from({ length: planned }, (_, i) => ({ id: `${id}-p${i}`, names: { it: 'x', en: 'x' } })),
});
const card = (id: string, module: string) => ({ id, module });

describe('chaptersOf (the chapters that have a page)', () => {
  it('keeps the modules with a published card, in module order, and counts the planned cards in the total', () => {
    const data = { modules: [mod('a', 1, 2), mod('b', 2, 0), mod('c', 3, 1)], entities: [card('x', 'a'), card('y', 'c'), card('z', 'c')] } as unknown as Data;
    expect(chaptersOf(data).map((c) => [c.id, c.cards.map((e) => e.id), c.total])).toEqual([
      ['a', ['x'], 3],
      ['c', ['y', 'z'], 3],
    ]);
  });

  it('is empty when no card is published', () => {
    expect(chaptersOf({ modules: [mod('a', 1, 4)], entities: [] } as unknown as Data)).toEqual([]);
  });

  it('keeps the order of the entities it is given inside a chapter', () => {
    const data = { modules: [mod('a', 1, 0)], entities: [card('m', 'a'), card('b', 'a'), card('z', 'a')] } as unknown as Data;
    expect(chaptersOf(data)[0]!.cards.map((e) => e.id)).toEqual(['m', 'b', 'z']);
  });
});
