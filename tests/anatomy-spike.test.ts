import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { EXTMeshoptCompression, KHRMeshQuantization } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import { describe, expect, it } from 'vitest';
import { parseObj } from '../scripts/anatomy/lib.mjs';
import { buildGlbs, frameOf, runSpike, toFrame } from '../scripts/anatomy/spike.mjs';

/** A smooth n x n grid patch (millimetres, Z up), 2 n^2 triangles. */
function gridObj(n: number): string {
  const lines: string[] = [];
  for (let j = 0; j <= n; j += 1) for (let i = 0; i <= n; i += 1) lines.push(`v ${i * 10} ${j * 10} ${100 + 5 * Math.sin(i / 6) * Math.cos(j / 6)}`);
  const w = n + 1;
  for (let j = 0; j < n; j += 1) {
    for (let i = 0; i < n; i += 1) {
      const a = j * w + i + 1;
      lines.push(`f ${a} ${a + 1} ${a + w + 1} ${a + w}`);
    }
  }
  return lines.join('\n');
}

async function read(bytes: Uint8Array) {
  const io = new NodeIO().registerExtensions([EXTMeshoptCompression, KHRMeshQuantization]).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
  await MeshoptDecoder.ready;
  return io.readBinary(bytes);
}

describe('frame', () => {
  it('is a proper rotation: Z up -> Y up, front -Y -> +Z, left +X stays +X', () => {
    const shell = new Float32Array([0, 0, 10, 2000, 1000, 1810]);
    const f = frameOf(shell);
    expect(f).toEqual({ cx: 1000, cy: 500, zmin: 10 });
    // a point in front (smaller y) and higher (larger z) and to the left (larger x)
    const out = toFrame(new Float32Array([1100, 400, 1010]), f);
    expect(Array.from(out)).toEqual([expect.closeTo(0.1, 6), expect.closeTo(1, 6), expect.closeTo(0.1, 6)]);
  });
});

describe('buildGlbs', () => {
  it('builds one fixture organ, quantized and meshopt, and reads it back', async () => {
    const src = parseObj(gridObj(30));
    const frame = frameOf(src.positions);
    const target = 300;
    const { quantized, meshopt, triangles, meshoptNoNormals } = await buildGlbs('heart', toFrame(src.positions, frame), src.indices, target);
    expect(triangles).toBeLessThanOrEqual(target);
    expect(triangles).toBeGreaterThan(0);
    expect(meshopt.length).toBeLessThan(quantized.length);
    expect(meshoptNoNormals).toBeLessThan(meshopt.length); // normals cost bytes: the spike reports how many

    for (const bytes of [quantized, meshopt]) {
      const doc = await read(bytes);
      const meshes = doc.getRoot().listMeshes();
      expect(meshes.map((m) => m.getName())).toEqual(['heart']);
      const prim = meshes[0].listPrimitives()[0];
      expect(prim.getIndices()!.getCount() / 3).toBe(triangles);
      // the viewer needs normals (Lambert shading and the Fresnel shell): one per vertex, unit length after dequantizing
      const normal = prim.getAttribute('NORMAL')!;
      expect(normal.getCount()).toBe(prim.getAttribute('POSITION')!.getCount());
      const first = normal.getElement(0, [0, 0, 0]);
      expect(Math.hypot(first[0], first[1], first[2])).toBeCloseTo(1, 1);
    }
  });
});

describe('runSpike', () => {
  it('writes both files per organ and target and returns the table rows', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'anatomy-spike-run-'));
    const raw = join(dir, 'raw');
    const tables = join(dir, 'tables');
    mkdirSync(join(raw, 'isa_obj'), { recursive: true });
    mkdirSync(tables);
    writeFileSync(join(raw, 'isa_obj', 'FJ1.obj'), gridObj(40));
    writeFileSync(join(tables, 'partof_parts_list_e.txt'), 'c\tr\ten\nFMA1\tB1\tskin\nFMA2\tB2\theart\n');
    writeFileSync(join(tables, 'partof_element_parts.txt'), 'c\tn\te\nFMA1\tskin\tFJ1\nFMA2\theart\tFJ1\n');
    writeFileSync(join(tables, 'isa_parts_list_e.txt'), 'c\tr\ten\n');
    writeFileSync(join(tables, 'isa_element_parts.txt'), 'c\tn\te\n');
    const map = join(dir, 'map.yaml');
    writeFileSync(map, 'shell: { concepts: [skin] }\norgans:\n  heart: { kind: mesh, concepts: [heart] }\n');
    const rows = await runSpike({ raw, tables, out: join(dir, 'out'), map, organs: ['heart'], targets: { heart: [200, 500], shell: [300] } });
    expect(rows.map((r: { organ: string; target: number }) => `${r.organ}:${r.target}`)).toEqual(['shell:300', 'heart:200', 'heart:500']);
    expect(rows[1].objBytes).toBeGreaterThan(0);
    expect(rows[1].meshoptBytes).toBeLessThan(rows[1].quantizedBytes);
  });
});
