import { mkdirSync, mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { EXTMeshoptCompression, KHRMeshQuantization } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import { describe, expect, it } from 'vitest';
import { BODY_CREDIT, buildBody } from '../scripts/anatomy/build-body.mjs';

/** A smooth n x n grid patch (millimetres, Z up) shifted by dx, 2 n^2 triangles. */
function gridObj(n: number, dx: number): string {
  const lines: string[] = [];
  for (let j = 0; j <= n; j += 1) for (let i = 0; i <= n; i += 1) lines.push(`v ${dx + i * 10} ${j * 10} ${100 + 5 * Math.sin(i / 6) * Math.cos(j / 6)}`);
  const w = n + 1;
  for (let j = 0; j < n; j += 1) {
    for (let i = 0; i < n; i += 1) {
      const a = j * w + i + 1;
      lines.push(`f ${a} ${a + 1} ${a + w + 1} ${a + w}`);
    }
  }
  return lines.join('\n');
}

function fixture() {
  const dir = mkdtempSync(join(tmpdir(), 'anatomy-build-'));
  const raw = join(dir, 'raw');
  const tables = join(dir, 'tables');
  mkdirSync(join(raw, 'isa_obj'), { recursive: true });
  mkdirSync(tables);
  writeFileSync(join(raw, 'isa_obj', 'FJ1.obj'), gridObj(40, 0));
  writeFileSync(join(raw, 'isa_obj', 'FJ2.obj'), gridObj(30, 100));
  writeFileSync(join(raw, 'isa_obj', 'FJ3.obj'), gridObj(20, 200));
  writeFileSync(join(tables, 'partof_parts_list_e.txt'), 'c\tr\ten\nFMA1\tB1\tskin\nFMA2\tB2\theart\nFMA3\tB3\tlung\n');
  writeFileSync(join(tables, 'partof_element_parts.txt'), 'c\tn\te\nFMA1\tskin\tFJ1\nFMA2\theart\tFJ2\nFMA3\tlung\tFJ3\n');
  writeFileSync(join(tables, 'isa_parts_list_e.txt'), 'c\tr\ten\n');
  writeFileSync(join(tables, 'isa_element_parts.txt'), 'c\tn\te\n');
  const map = join(dir, 'map.yaml');
  const organs = ['skin: { kind: mesh, concepts: [skin] }', 'heart: { kind: mesh, concepts: [heart] }', 'lung: { kind: mesh, concepts: [lung] }', 'pleura: { kind: proxy, of: [lung] }', 'valves: { kind: none, inside: heart }'];
  writeFileSync(map, `shell: { concepts: [skin] }\norgans:\n  ${organs.join('\n  ')}\n`);
  const anatomy = join(dir, 'anatomy.yaml');
  const ids = ['skin', 'heart', 'lung', 'pleura', 'valves'];
  writeFileSync(anatomy, ids.map((id) => `- { id: ${id}, system: ${id === 'skin' ? 'skin' : 'thorax'} }`).join('\n'));
  return { dir, raw, tables, map, anatomy };
}

async function read(path: string) {
  const io = new NodeIO().registerExtensions([EXTMeshoptCompression, KHRMeshQuantization]).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
  await MeshoptDecoder.ready;
  return io.read(path);
}

describe('build-body', () => {
  it('builds two organs into one system file, the shell and the manifest', async () => {
    const f = fixture();
    const out = join(f.dir, 'out');
    const targets = { shell: 300, heart: 200, lung: 150 };
    const manifest = await buildBody({ raw: f.raw, tables: f.tables, out, map: f.map, anatomy: f.anatomy, targets });

    const doc = await read(join(out, 'thorax.glb'));
    expect(doc.getRoot().listMeshes().map((m) => m.getName()).sort()).toEqual(['heart', 'lung']);
    expect(doc.getRoot().listNodes().map((n) => n.getName()).sort()).toEqual(['heart', 'lung']);
    for (const mesh of doc.getRoot().listMeshes()) {
      const prim = mesh.listPrimitives()[0];
      expect(prim.getAttribute('NORMAL')!.getCount()).toBe(prim.getAttribute('POSITION')!.getCount());
    }
    const shell = await read(join(out, 'shell.glb'));
    expect(shell.getRoot().listMeshes().map((m) => m.getName())).toEqual(['skin']);

    const onDisk = JSON.parse(readFileSync(join(out, 'manifest.json'), 'utf8'));
    expect(onDisk).toEqual(manifest);
    expect(onDisk.version).toBe(1);
    expect(onDisk.credit).toBe(BODY_CREDIT);
    expect(onDisk.shell.file).toBe('shell.glb');
    expect(onDisk.shell.bytes).toBe(statSync(join(out, 'shell.glb')).size);
    expect(onDisk.shell.triangles).toBeLessThanOrEqual(300);
    expect(Object.keys(onDisk.systems)).toEqual(['thorax']);
    const sys = onDisk.systems.thorax;
    expect(sys).toMatchObject({ file: 'thorax.glb', organs: ['heart', 'lung'], bytes: statSync(join(out, 'thorax.glb')).size });
    const inFile = doc.getRoot().listMeshes().reduce((n, m) => n + m.listPrimitives()[0].getIndices()!.getCount() / 3, 0);
    expect(sys.triangles).toBe(inFile);
    expect(sys.triangles).toBeLessThanOrEqual(350);
    expect(Object.keys(onDisk.organs).sort()).toEqual(['heart', 'lung', 'pleura', 'skin', 'valves']);
    const heart = onDisk.organs.heart;
    expect(heart).toMatchObject({ system: 'thorax', kind: 'mesh', of: [], inside: null });
    // x of the heart patch is 100..400 mm in the source; the shell centre is at 200 mm, so about -0.1..0.2 m
    expect(heart.box.min[0]).toBeCloseTo(-0.1, 1);
    expect(heart.box.max[0]).toBeCloseTo(0.2, 1);
    expect(heart.centre[0]).toBeCloseTo(0.05, 1);
    expect(onDisk.organs.skin.box).toBeDefined();
    expect(onDisk.organs.pleura).toEqual({ system: 'thorax', kind: 'proxy', of: ['lung'], inside: null });
    expect(onDisk.organs.valves.inside).toBe('heart');
  });

  it('builds one system with --only and leaves the shell and the manifest alone', async () => {
    const f = fixture();
    const out = join(f.dir, 'out');
    await buildBody({ raw: f.raw, tables: f.tables, out, map: f.map, anatomy: f.anatomy, targets: { shell: 300 }, only: 'thorax' });
    expect(statSync(join(out, 'thorax.glb')).size).toBeGreaterThan(0);
    expect(() => statSync(join(out, 'manifest.json'))).toThrow();
  });

  it('fails with a clear message when a file passes its budget', async () => {
    const f = fixture();
    const out = join(f.dir, 'out');
    const run = (budgets: Record<string, number>) => buildBody({ raw: f.raw, tables: f.tables, out, map: f.map, anatomy: f.anatomy, targets: { shell: 300 }, budgets });
    await expect(run({ system: 500 })).rejects.toThrow(/thorax\.glb.*budget of 500 bytes/);
    await expect(run({ shell: 500 })).rejects.toThrow(/shell\.glb.*budget of 500 bytes/);
    await expect(run({ manifest: 100 })).rejects.toThrow(/manifest\.json.*budget of 100 bytes/);
  });
});
