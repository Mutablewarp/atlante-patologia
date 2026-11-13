// Size spike of the body build: how small five organs and the shell get (docs/BODY_SPEC.md §4, §11).
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Document, Logger, NodeIO } from '@gltf-transform/core';
import { EXTMeshoptCompression, KHRMeshQuantization } from '@gltf-transform/extensions';
import { cloneDocument, meshopt, quantize, simplify, weld } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import { bbox, computeNormals, mergeMeshes, parseObj, readOrganMap, readTables, resolveElements } from './lib.mjs';

export const SPIKE_ORGANS = ['heart', 'lung', 'liver', 'kidney', 'stomach'];
export const SPIKE_TARGETS = /** @type {Record<string, number[]>} */ ({ shell: [8000, 16000, 30000], organ: [2000, 5000, 12000] });

/**
 * The shell's own numbers, in source millimetres: centre of its x range, centre of its y range, lowest z.
 * @param {Float32Array} shellPositions
 * @returns {{ cx: number, cy: number, zmin: number }}
 */
export function frameOf(shellPositions) {
  const { min, centre } = bbox(shellPositions);
  return { cx: centre[0], cy: centre[1], zmin: min[2] };
}

/**
 * Source frame (mm, Z up, front -Y, left +X) -> spec frame (m, Y up, front +Z, left +X). A rotation: det = +1, no mirror.
 * @param {Float32Array} positions
 * @param {{ cx: number, cy: number, zmin: number }} frame
 */
export function toFrame(positions, { cx, cy, zmin }) {
  const out = new Float32Array(positions.length);
  for (let k = 0; k < positions.length; k += 3) {
    out[k] = (positions[k] - cx) / 1000;
    out[k + 1] = (positions[k + 2] - zmin) / 1000;
    out[k + 2] = -(positions[k + 1] - cy) / 1000;
  }
  return out;
}

function makeIo() {
  return new NodeIO().registerExtensions([EXTMeshoptCompression, KHRMeshQuantization]).registerDependencies({
    'meshopt.encoder': MeshoptEncoder,
    'meshopt.decoder': MeshoptDecoder,
  });
}

/**
 * Weld, simplify to `target` triangles, add smooth normals, quantize; then the same document with meshopt compression.
 * `meshoptNoNormals` is the size of the compressed file without normals (three.js can compute them on load).
 * @param {string} name
 * @param {Float32Array} positions
 * @param {Uint32Array} indices
 * @param {number} target
 * @returns {Promise<{ quantized: Uint8Array, meshopt: Uint8Array, triangles: number, meshoptNoNormals: number }>}
 */
export async function buildGlbs(name, positions, indices, target) {
  await Promise.all([MeshoptEncoder.ready, MeshoptDecoder.ready, MeshoptSimplifier.ready]);
  // gltf-transform logs every transform on stdout, which would break the JSON this script prints
  const doc = new Document().setLogger(new Logger(Logger.Verbosity.SILENT));
  const buffer = doc.createBuffer();
  const prim = doc.createPrimitive()
    .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(positions).setBuffer(buffer))
    .setIndices(doc.createAccessor().setType('SCALAR').setArray(indices).setBuffer(buffer));
  const mesh = doc.createMesh(name).addPrimitive(prim);
  doc.createScene().addChild(doc.createNode(name).setMesh(mesh));

  await doc.transform(weld());
  const welded = /** @type {NonNullable<ReturnType<typeof prim.getIndices>>} */ (prim.getIndices()).getCount() / 3;
  // error 1 = no geometric limit: the target count decides, because the spike measures size at a given count.
  if (welded > target) await doc.transform(simplify({ simplifier: MeshoptSimplifier, ratio: target / welded, error: 1 }));

  const io = makeIo();
  const bare = cloneDocument(doc).setLogger(new Logger(Logger.Verbosity.SILENT));
  await bare.transform(quantize(), meshopt({ encoder: MeshoptEncoder, level: 'high' }));
  const meshoptNoNormals = (await io.writeBinary(bare)).length;

  const finalPositions = /** @type {Float32Array} */ (/** @type {any} */ (prim.getAttribute('POSITION')).getArray());
  const finalIndices = /** @type {Uint32Array} */ (/** @type {any} */ (prim.getIndices()).getArray());
  prim.setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(computeNormals(finalPositions, finalIndices)).setBuffer(buffer));
  await doc.transform(quantize());
  const quantized = await io.writeBinary(doc);
  const triangles = /** @type {any} */ (prim.getIndices()).getCount() / 3;
  await doc.transform(meshopt({ encoder: MeshoptEncoder, level: 'high' }));
  return { quantized, meshopt: await io.writeBinary(doc), triangles, meshoptNoNormals };
}

function objDir(raw) {
  return existsSync(join(raw, 'isa_obj')) ? join(raw, 'isa_obj') : raw;
}

function loadConcepts(raw, tables, concepts, minus = []) {
  const files = resolveElements(tables, concepts, minus).map((id) => join(objDir(raw), `${id}.obj`));
  const mesh = mergeMeshes(files.map((f) => parseObj(readFileSync(f, 'utf8'))));
  return { mesh, bytes: files.reduce((n, f) => n + statSync(f).size, 0) };
}

/**
 * @typedef {{ organ: string, target: number, triangles: number, objBytes: number, quantizedBytes: number, meshoptBytes: number, meshoptNoNormalsBytes: number }} SpikeRow
 */

/**
 * Build every organ and the shell at its targets, write the two .glb files each, return the table rows.
 * @param {{ raw: string, tables: string, out: string, map: string, organs?: string[], targets?: Record<string, number[]> }} options
 * @returns {Promise<SpikeRow[]>}
 */
export async function runSpike({ raw, tables: tablesDir, out, map: mapPath, organs = SPIKE_ORGANS, targets = SPIKE_TARGETS }) {
  const map = readOrganMap(mapPath);
  const tables = readTables(tablesDir);
  mkdirSync(out, { recursive: true });
  const shell = loadConcepts(raw, tables, map.shell.concepts);
  const frame = frameOf(shell.mesh.positions);
  /** @type {[string, string, { mesh: { positions: Float32Array, indices: Uint32Array }, bytes: number }, number[]][]} */
  const jobs = [['shell', 'skin', shell, targets.shell]];
  for (const id of organs) {
    const o = map.organs[id];
    jobs.push([id, id, loadConcepts(raw, tables, o.concepts, o.minus ?? []), targets[id] ?? targets.organ]);
  }
  /** @type {SpikeRow[]} */
  const rows = [];
  for (const [organ, meshName, { mesh, bytes }, list] of jobs) {
    const positions = toFrame(mesh.positions, frame);
    for (const target of list) {
      const built = await buildGlbs(meshName, positions, mesh.indices, target);
      writeFileSync(join(out, `${organ}-${target}.quantized.glb`), built.quantized);
      writeFileSync(join(out, `${organ}-${target}.meshopt.glb`), built.meshopt);
      rows.push({ organ, target, triangles: built.triangles, objBytes: bytes, quantizedBytes: built.quantized.length, meshoptBytes: built.meshopt.length, meshoptNoNormalsBytes: built.meshoptNoNormals });
    }
  }
  return rows;
}

function arg(name) {
  const at = process.argv.indexOf(`--${name}`);
  if (at < 0 || !process.argv[at + 1]) throw new Error(`missing --${name}`);
  return process.argv[at + 1];
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const rows = await runSpike({ raw: arg('raw'), tables: arg('tables'), out: arg('out'), map: 'scripts/anatomy/organ-map.yaml' });
  console.log(`[\n${rows.map((r) => JSON.stringify(r)).join(',\n')}\n]`);
}
