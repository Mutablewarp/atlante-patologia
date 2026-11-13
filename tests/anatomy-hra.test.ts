import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Document, NodeIO } from '@gltf-transform/core';
import { describe, expect, it } from 'vitest';
import { bbox } from '../scripts/anatomy/lib.mjs';
import { fitTransform, hraFile, loadHra } from '../scripts/anatomy/hra.mjs';

const apply = (t: { scale: number; translate: number[] }, p: number[]) => p.map((v, a) => v * t.scale + t.translate[a]);
const box = (min: number[], max: number[]) => ({ min, max });

describe('fitTransform', () => {
  const from = box([0, 0, 0], [2, 2, 1]);
  const to = box([10, 20, 30], [16, 26, 33]);

  it('maps a box onto its target with the centre anchor', () => {
    const t = fitTransform(from, to);
    expect(t.scale).toBeCloseTo(3, 9);
    const lo = apply(t, from.min);
    const hi = apply(t, from.max);
    to.min.forEach((v, a) => expect(lo[a]).toBeCloseTo(v, 9));
    to.max.forEach((v, a) => expect(hi[a]).toBeCloseTo(v, 9));
  });

  it('puts the maximum-Z faces together with the front anchor and keeps the centres on X and Y', () => {
    const narrow = box([0, 0, 0], [2, 2, 2]);
    const t = fitTransform(narrow, to, 'front');
    const lo = apply(t, narrow.min);
    const hi = apply(t, narrow.max);
    expect(hi[2]).toBeCloseTo(to.max[2], 9);
    expect((lo[0] + hi[0]) / 2).toBeCloseTo(13, 9);
    expect((lo[1] + hi[1]) / 2).toBeCloseTo(23, 9);
    expect((lo[2] + hi[2]) / 2).not.toBeCloseTo(31.5, 3);
  });
});

describe('loadHra', () => {
  async function fixture() {
    const doc = new Document();
    const buffer = doc.createBuffer();
    const mesh = (name: string, z: number) => {
      const prim = doc.createPrimitive()
        .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(new Float32Array([0, 0, z, 1, 0, z, 0, 1, z])).setBuffer(buffer))
        .setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint16Array([0, 1, 2])).setBuffer(buffer));
      return doc.createMesh(name).addPrimitive(prim);
    };
    const scene = doc.createScene();
    scene.addChild(doc.createNode('A').setMesh(mesh('A', 0)).setTranslation([5, 0, 0]));
    scene.addChild(doc.createNode('B').setMesh(mesh('B', 2)));
    const file = join(mkdtempSync(join(tmpdir(), 'anatomy-hra-')), 'x.glb');
    writeFileSync(file, await new NodeIO().writeBinary(doc));
    return file;
  }

  it('reads a translated node in world coordinates', async () => {
    const mesh = await loadHra(await fixture(), ['A']);
    expect(bbox(mesh.positions).min).toEqual([5, 0, 0]);
    expect(bbox(mesh.positions).max).toEqual([6, 1, 0]);
  });

  it('takes the named nodes only, or all of them', async () => {
    const file = await fixture();
    expect((await loadHra(file, ['B'])).indices.length).toBe(3);
    expect(bbox((await loadHra(file, ['B'])).positions).max[2]).toBe(2);
    const all = await loadHra(file);
    expect(all.indices.length).toBe(6);
    expect(Math.max(...all.indices)).toBe(5);
  });

  it('names the file of an object', () => {
    expect(hraFile('/h', 'uterus-female/v1.2')).toBe('/h/uterus-female_v1.2.glb');
  });
});
