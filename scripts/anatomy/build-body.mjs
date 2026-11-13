// Build of the body assets: shell.glb, one glb per system and manifest.json (docs/BODY_SPEC.md §4, §11).
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Document, Logger, NodeIO } from '@gltf-transform/core';
import { EXTMeshoptCompression, KHRMeshQuantization } from '@gltf-transform/extensions';
import { meshopt, quantize, simplify, weld } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import { parse } from 'yaml';
import { bbox, computeNormals, mergeMeshes, parseObj, readOrganMap, readTables, resolveElements } from './lib.mjs';
import { fitTransform, hraFile, loadHra } from './hra.mjs';
import { frameOf, toFrame } from './spike.mjs';

/** Triangle targets of the table below spec §11; an organ that is not listed keeps its source count. */
export const TARGETS = /** @type {Record<string, number>} */ ({
  shell: 24000,
  heart: 12000,
  lung: 12000,
  liver: 12000,
  brain: 12000,
  bones: 24000,
  'skeletal-muscle': 24000,
  'lower-limb-veins': 6000,
  'trachea-bronchi': 6000,
  'oral-cavity': 6000,
  'small-intestine': 8000,
  colon: 8000,
  pancreas: 5000,
  kidney: 5292,
  aorta: 4000,
  'heart-valves': 4000,
  'adrenal-gland': 4000,
  'nasal-cavity-sinuses': 4000,
  pharynx: 4000,
  larynx: 4000,
  eye: 4000,
  'gallbladder-bile-ducts': 3000,
  uterus: 3000,
  'uterine-cervix': 1500,
  'fallopian-tube': 3000,
  breast: 6000,
});

/** Bytes on disk, spec §4. */
export const BUDGETS = { shell: 400_000, system: 500_000, manifest: 12_000 };

export const BODY_CREDIT = 'BodyParts3D, © The Database Center for Life Science licensed under CC Attribution 4.0 International';

const SHELL_ORGAN = 'skin';

function makeIo() {
  return new NodeIO().registerExtensions([EXTMeshoptCompression, KHRMeshQuantization]).registerDependencies({
    'meshopt.encoder': MeshoptEncoder,
    'meshopt.decoder': MeshoptDecoder,
  });
}

function silentDocument() {
  // gltf-transform logs every transform on stdout, which would break the JSON this script prints
  return new Document().setLogger(new Logger(Logger.Verbosity.SILENT));
}

/**
 * Weld, then simplify to `target` triangles when the welded mesh has more; recompute smooth normals.
 * @param {Float32Array} positions
 * @param {Uint32Array} indices
 * @param {number | undefined} target
 * @returns {Promise<{ positions: Float32Array, indices: Uint32Array, normals: Float32Array }>}
 */
export async function reduceMesh(positions, indices, target) {
  const doc = silentDocument();
  const buffer = doc.createBuffer();
  const prim = doc.createPrimitive()
    .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(positions).setBuffer(buffer))
    .setIndices(doc.createAccessor().setType('SCALAR').setArray(indices).setBuffer(buffer));
  doc.createScene().addChild(doc.createNode('m').setMesh(doc.createMesh('m').addPrimitive(prim)));
  await doc.transform(weld());
  const welded = /** @type {any} */ (prim.getIndices()).getCount() / 3;
  // error 1 = no geometric limit: the target count decides
  if (target !== undefined && welded > target) await doc.transform(simplify({ simplifier: MeshoptSimplifier, ratio: target / welded, error: 1 }));
  const outPositions = new Float32Array(/** @type {any} */ (prim.getAttribute('POSITION')).getArray());
  const outIndices = new Uint32Array(/** @type {any} */ (prim.getIndices()).getArray());
  return { positions: outPositions, indices: outIndices, normals: computeNormals(outPositions, outIndices) };
}

/**
 * One document, one mesh and one node per organ named by its id, quantized and meshopt-compressed as a whole.
 * @param {{ id: string, positions: Float32Array, indices: Uint32Array, normals: Float32Array }[]} organs
 * @returns {Promise<Uint8Array>}
 */
export async function writeSystemGlb(organs) {
  const doc = silentDocument();
  const buffer = doc.createBuffer();
  const scene = doc.createScene();
  for (const { id, positions, indices, normals } of organs) {
    const prim = doc.createPrimitive()
      .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(positions).setBuffer(buffer))
      .setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(normals).setBuffer(buffer))
      .setIndices(doc.createAccessor().setType('SCALAR').setArray(indices).setBuffer(buffer));
    scene.addChild(doc.createNode(id).setMesh(doc.createMesh(id).addPrimitive(prim)));
  }
  await doc.transform(quantize(), meshopt({ encoder: MeshoptEncoder, level: 'high' }));
  return makeIo().writeBinary(doc);
}

function objDir(raw) {
  return existsSync(join(raw, 'isa_obj')) ? join(raw, 'isa_obj') : raw;
}

function loadConcepts(raw, tables, id, concepts, minus = []) {
  const files = resolveElements(tables, concepts, minus);
  if (files.length === 0) throw new Error(`organ "${id}": its concepts have no element files`);
  return mergeMeshes(files.map((f) => parseObj(readFileSync(join(objDir(raw), `${f}.obj`), 'utf8'))));
}

async function loadObjects(hra, objects, nodes) {
  const meshes = [];
  for (const object of objects) meshes.push(await loadHra(hraFile(hra, object), nodes));
  return mergeMeshes(meshes);
}

/** The fit of two union boxes in the shell frame: all nodes of the HRA objects, and the element files of the BodyParts3D concepts. */
async function fitOf(fit, hra, raw, tables, frame) {
  const hraBox = bbox((await loadObjects(hra, fit.hra)).positions);
  const bp3dBox = bbox(toFrame(loadConcepts(raw, tables, 'fit', fit.bp3d).positions, frame));
  return fitTransform(hraBox, bp3dBox, fit.anchor);
}

// "+ 0" turns -0 into 0, so the JSON on disk reads back equal
const round = (list) => list.map((v) => Math.round(v * 1e4) / 1e4 + 0);

function checkBudget(file, bytes, budget) {
  if (bytes > budget) throw new Error(`${file} is ${bytes} bytes, which passes its budget of ${budget} bytes`);
}

/**
 * Build the body assets. With `only` (a system id) just that system file is written, with no shell and no manifest.
 * @param {{ raw: string, tables: string, out: string, map?: string, anatomy?: string, targets?: Record<string, number>, budgets?: Partial<typeof BUDGETS>, only?: string, hra?: string }} options
 */
export async function buildBody({ raw, tables: tablesDir, out, map: mapPath = 'scripts/anatomy/organ-map.yaml', anatomy = 'src/content/anatomy.yaml', targets = TARGETS, budgets = {}, only, hra = join(raw, '..', 'hra') }) {
  await Promise.all([MeshoptEncoder.ready, MeshoptDecoder.ready, MeshoptSimplifier.ready]);
  const limit = { ...BUDGETS, ...budgets };
  const map = readOrganMap(mapPath);
  const tables = readTables(tablesDir);
  /** @type {Map<string, string>} */
  const systemOf = new Map(parse(readFileSync(anatomy, 'utf8')).map((o) => [o.id, o.system]));
  for (const id of Object.keys(map.organs)) if (!systemOf.has(id)) throw new Error(`organ "${id}" is not in ${anatomy}`);

  const shellMesh = loadConcepts(raw, tables, 'shell', map.shell.concepts);
  const frame = frameOf(shellMesh.positions);
  mkdirSync(out, { recursive: true });
  /** @type {Record<string, any>} */
  const organs = {};
  /** @type {Record<string, { id: string, positions: Float32Array, indices: Uint32Array, normals: Float32Array }[]>} */
  const built = {};
  /** @type {Record<string, { scale: number, translate: number[] }>} */
  const fits = {};
  for (const [id, organ] of Object.entries(map.organs)) {
    const system = systemOf.get(id);
    organs[id] = { system, kind: organ.kind, of: organ.of ?? [], inside: organ.inside ?? null };
    if (!['mesh', 'hra'].includes(organ.kind) || id === SHELL_ORGAN || (only !== undefined && system !== only)) continue;
    let reduced;
    if (organ.kind === 'hra') {
      fits[organ.fit] ??= await fitOf(map.fits[organ.fit], hra, raw, tables, frame);
      const { scale, translate } = fits[organ.fit];
      const mesh = await loadObjects(hra, organ.objects, organ.nodes);
      reduced = await reduceMesh(mesh.positions.map((v, k) => v * scale + translate[k % 3]), mesh.indices, targets[id]);
      Object.assign(organs[id], { fit: organ.fit, objects: organ.objects });
    } else {
      const mesh = loadConcepts(raw, tables, id, organ.concepts, organ.minus ?? []);
      reduced = await reduceMesh(toFrame(mesh.positions, frame), mesh.indices, targets[id]);
    }
    const { min, max, centre } = bbox(reduced.positions);
    Object.assign(organs[id], { box: { min: round(min), max: round(max) }, centre: round(centre), triangles: reduced.indices.length / 3 });
    (built[system] ??= []).push({ id, ...reduced });
  }
  /** @type {Record<string, any>} */
  const systems = {};
  for (const [system, list] of Object.entries(built)) {
    const bytes = await writeSystemGlb(list);
    const file = `${system}.glb`;
    checkBudget(file, bytes.length, limit.system);
    writeFileSync(join(out, file), bytes);
    systems[system] = { file, bytes: bytes.length, triangles: list.reduce((n, o) => n + organs[o.id].triangles, 0), organs: list.map((o) => o.id) };
  }
  if (only !== undefined) return { systems };

  const shell = await reduceMesh(toFrame(shellMesh.positions, frame), shellMesh.indices, targets.shell);
  const shellBytes = await writeSystemGlb([{ id: SHELL_ORGAN, ...shell }]);
  checkBudget('shell.glb', shellBytes.length, limit.shell);
  writeFileSync(join(out, 'shell.glb'), shellBytes);
  if (SHELL_ORGAN in organs) {
    const { min, max, centre } = bbox(shell.positions);
    Object.assign(organs[SHELL_ORGAN], { box: { min: round(min), max: round(max) }, centre: round(centre) });
  }

  for (const o of Object.values(organs)) delete o.triangles;
  const manifest = { version: 1, credit: BODY_CREDIT, shell: { file: 'shell.glb', bytes: shellBytes.length, triangles: shell.indices.length / 3 }, systems, organs };
  const json = JSON.stringify(manifest);
  checkBudget('manifest.json', Buffer.byteLength(json), limit.manifest);
  writeFileSync(join(out, 'manifest.json'), json);
  return manifest;
}

function arg(name, required = true) {
  const at = process.argv.indexOf(`--${name}`);
  if (at < 0 || !process.argv[at + 1]) {
    if (required) throw new Error(`missing --${name}`);
    return undefined;
  }
  return process.argv[at + 1];
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const manifest = await buildBody({ raw: arg('raw'), tables: arg('tables'), out: arg('out'), only: arg('only', false), hra: arg('hra', false) });
  const systems = Object.entries(manifest.systems).map(([id, s]) => `${id} ${s.bytes}B/${s.triangles}t`);
  const total = 'shell' in manifest ? ` + shell ${manifest.shell.bytes}B/${manifest.shell.triangles}t` : '';
  console.log(`built: ${systems.join(', ')}${total}`);
}
