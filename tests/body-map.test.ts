import { describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parse } from 'yaml';
import { loadBodyMap } from '../src/lib/body-map.ts';

function rootWith(yamlText: string): string {
  const root = mkdtempSync(join(tmpdir(), 'body-map-'));
  mkdirSync(join(root, 'scripts/anatomy'), { recursive: true });
  writeFileSync(join(root, 'scripts/anatomy/organ-map.yaml'), yamlText);
  return root;
}

describe('loadBodyMap on handwritten files', () => {
  const text = `shell: { concepts: [skin] }
organs:
  heart: { kind: mesh, concepts: [heart] }
  heart-valves: { kind: mesh, concepts: [aortic valve], inside: heart }
  pleura: { kind: proxy, of: [lung] }
  vulva: { kind: none }
`;
  it('returns kind, of and inside for every organ', () => {
    const map = loadBodyMap(rootWith(text));
    expect([...map.keys()]).toEqual(['heart', 'heart-valves', 'pleura', 'vulva']);
    expect(map.get('heart')).toEqual({ kind: 'mesh', of: [] });
    expect(map.get('heart-valves')).toEqual({ kind: 'mesh', of: [], inside: 'heart' });
    expect(map.get('pleura')).toEqual({ kind: 'proxy', of: ['lung'] });
    expect(map.get('vulva')).toEqual({ kind: 'none', of: [] });
  });
  it('rejects an unknown kind', () => {
    expect(() => loadBodyMap(rootWith('organs:\n  x: { kind: blob }\n'))).toThrow();
  });
  it('rejects a bad `of` or `inside`', () => {
    expect(() => loadBodyMap(rootWith('organs:\n  x: { kind: proxy, of: lung }\n'))).toThrow();
    expect(() => loadBodyMap(rootWith('organs:\n  x: { kind: mesh, inside: 3 }\n'))).toThrow();
  });
});

describe('loadBodyMap on the real map', () => {
  const anatomy = parse(readFileSync('src/content/anatomy.yaml', 'utf8')) as { id: string }[];
  const map = loadBodyMap();
  it('has an entry for every organ of anatomy.yaml', () => {
    expect(anatomy.filter((o) => !map.has(o.id)).map((o) => o.id)).toEqual([]);
  });
  it('points `of` and `inside` at organs that exist', () => {
    for (const [id, e] of map) {
      for (const t of [...e.of, ...(e.inside ? [e.inside] : [])]) expect(map.has(t), `${id} -> ${t}`).toBe(true);
    }
  });
});

describe('loadBodyMap: the sex of an HRA reference object', () => {
  const text = `organs:
  lung: { kind: hra, objects: [lung-male/v1.3], fit: lungs }
  ovary: { kind: hra, objects: [ovary-female-left/v1.3, ovary-female-right/v1.3], fit: pelvis }
  heart: { kind: mesh, concepts: [heart] }
`;
  it('marks an organ whose objects are all male, and nothing else', () => {
    const map = loadBodyMap(rootWith(text));
    expect(map.get('lung')?.male).toBe(true);
    expect(map.get('ovary')?.male).toBeUndefined();
    expect(map.get('heart')?.male).toBeUndefined();
  });
});
