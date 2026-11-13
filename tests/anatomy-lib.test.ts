import { existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { bbox, mergeMeshes, parseObj, readOrganMap, readTables, resolveElements, triangleCount } from '../scripts/anatomy/lib.mjs';

const RAW = '.work/anatomy/raw/bodyparts3d';

function fixtureDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'anatomy-lib-'));
  writeFileSync(join(dir, 'partof_parts_list_e.txt'), 'concept id\trepresentation id\ten\nFMA1\tBP1\theart\nFMA2\tBP2\tmitral valve\nFMA3\tBP3\taorta\n');
  writeFileSync(join(dir, 'partof_element_parts.txt'), 'concept id\tname\telement file id\nFMA1\theart\tFJ3\nFMA1\theart\tFJ1\nFMA1\theart\tFJ2\nFMA2\tmitral valve\tFJ2\nFMA3\taorta\tFJ9\n');
  writeFileSync(join(dir, 'isa_parts_list_e.txt'), 'concept id\trepresentation id\ten\nFMA7\tBP7\tspleen\n');
  writeFileSync(join(dir, 'isa_element_parts.txt'), 'concept id\tname\telement file id\nFMA7\tspleen\tFJ50\n');
  return dir;
}

describe('parseObj', () => {
  it('reads v and f lines, fans polygons, handles v/vt/vn corners and negative indices', () => {
    const text = [
      '# comment', 'o part', 'v 0 0 0', 'v 1 0 0', 'v 1 1 0', 'v 0 1 0', 'vn 0 0 1', 'vt 0 0',
      'f 1/1/1 2/1/1 3/1/1 4/1/1', 'f -4 -3 -2',
    ].join('\n');
    const m = parseObj(text);
    expect(m.positions).toBeInstanceOf(Float32Array);
    expect(m.indices).toBeInstanceOf(Uint32Array);
    expect(Array.from(m.positions)).toEqual([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0]);
    expect(Array.from(m.indices)).toEqual([0, 1, 2, 0, 2, 3, 0, 1, 2]);
  });
});

describe('readTables and resolveElements', () => {
  const tables = readTables(fixtureDir());

  it('maps names to concepts and concepts to element sets', () => {
    expect(tables.partof.byName.get('heart')).toBe('FMA1');
    expect([...tables.partof.elements.get('FMA1')]).toHaveLength(3);
    expect(tables.isa.byName.get('spleen')).toBe('FMA7');
  });

  it('resolves, unions, subtracts and sorts', () => {
    expect(resolveElements(tables, ['heart'])).toEqual(['FJ1', 'FJ2', 'FJ3']);
    expect(resolveElements(tables, ['heart'], ['mitral valve'])).toEqual(['FJ1', 'FJ3']);
    expect(resolveElements(tables, ['isa:spleen', 'aorta'])).toEqual(['FJ50', 'FJ9']);
  });

  it('looks a plain name up in PART-OF only and throws on an unknown name', () => {
    expect(() => resolveElements(tables, ['spleen'])).toThrow(/spleen/);
    expect(() => resolveElements(tables, ['isa:nope'])).toThrow(/nope/);
    expect(() => resolveElements(tables, ['heart'], ['ghost'])).toThrow(/ghost/);
  });
});

describe('mesh helpers', () => {
  const a = { positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]), indices: new Uint32Array([0, 1, 2]) };
  const b = { positions: new Float32Array([2, 2, 2, 3, 2, 2, 2, 4, 2]), indices: new Uint32Array([0, 1, 2]) };

  it('merges with index offsets', () => {
    const m = mergeMeshes([a, b]);
    expect(m.positions.length).toBe(18);
    expect(Array.from(m.indices)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(triangleCount(m)).toBe(2);
  });

  it('computes the bounding box', () => {
    expect(bbox(b.positions)).toEqual({ min: [2, 2, 2], max: [3, 4, 2], centre: [2.5, 3, 2] });
  });
});

describe('readOrganMap', () => {
  function mapFile(body: string): string {
    const p = join(mkdtempSync(join(tmpdir(), 'anatomy-map-')), 'organ-map.yaml');
    writeFileSync(p, body);
    return p;
  }

  it('accepts a valid map', () => {
    const map = readOrganMap(mapFile('fits:\n  pelvis: { hra: [x], bp3d: [y] }\norgans:\n  a: { kind: mesh, concepts: [heart] }\n  b: { kind: proxy, of: [a] }\n  c: { kind: hra, objects: [o], fit: pelvis }\n  d: { kind: mesh, concepts: [heart], inside: a }\n'));
    expect(Object.keys(map.organs)).toEqual(['a', 'b', 'c', 'd']);
  });

  it.each([
    ['unknown kind', 'organs:\n  a: { kind: blob }\n', /blob/],
    ['unknown of', 'organs:\n  a: { kind: proxy, of: [zzz] }\n', /zzz/],
    ['unknown inside', 'organs:\n  a: { kind: mesh, concepts: [x], inside: zzz }\n', /zzz/],
    ['unknown fit', 'organs:\n  a: { kind: hra, objects: [o], fit: zzz }\n', /zzz/],
  ])('rejects %s', (_label, body, re) => {
    expect(() => readOrganMap(mapFile(body))).toThrow(re);
  });
});

describe.skipIf(!existsSync(`${RAW}/partof_parts_list_e.txt`))('real organ map', () => {
  it('resolves every concept', () => {
    const tables = readTables(RAW);
    const map = readOrganMap('scripts/anatomy/organ-map.yaml');
    const entries = [...(map.shell ? [map.shell] : []), ...Object.values(map.organs)] as { concepts?: string[]; minus?: string[] }[];
    let n = 0;
    for (const o of entries) {
      if (!o.concepts) continue;
      expect(resolveElements(tables, o.concepts, o.minus ?? []).length).toBeGreaterThan(0);
      n += 1;
    }
    expect(n).toBeGreaterThan(30);
  });
});
