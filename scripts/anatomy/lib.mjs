// Pure mesh and table helpers shared by the body spike and the body build (docs/BODY_SPEC.md §3).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';

export const KINDS = ['mesh', 'hra', 'proxy', 'schematic', 'none'];

/** Wavefront OBJ -> flat typed arrays. Only `v` and `f` lines count; polygons are fanned from their first corner. */
export function parseObj(text) {
  const positions = [];
  const indices = [];
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (line.startsWith('v ')) {
      const [, x, y, z] = line.split(/\s+/);
      positions.push(Number(x), Number(y), Number(z));
    } else if (line.startsWith('f ')) {
      const count = positions.length / 3;
      // "v/vt/vn": the vertex is the part before the first slash; a negative index counts back from the last vertex.
      const corners = line.split(/\s+/).slice(1).map((c) => {
        const i = parseInt(c.split('/')[0], 10);
        return i < 0 ? count + i : i - 1;
      });
      for (let k = 1; k + 1 < corners.length; k += 1) indices.push(corners[0], corners[k], corners[k + 1]);
    }
  }
  return { positions: new Float32Array(positions), indices: new Uint32Array(indices) };
}

function readTable(path) {
  return readFileSync(path, 'utf8').split('\n').slice(1).filter((l) => l.trim() !== '').map((l) => l.split('\t'));
}

function readTree(dir, prefix) {
  const byName = new Map();
  for (const [conceptId, , name] of readTable(join(dir, `${prefix}_parts_list_e.txt`))) byName.set(name, conceptId);
  const elements = new Map();
  for (const [conceptId, , fileId] of readTable(join(dir, `${prefix}_element_parts.txt`))) {
    if (!elements.has(conceptId)) elements.set(conceptId, new Set());
    elements.get(conceptId).add(fileId);
  }
  return { byName, elements };
}

/** The PART-OF and IS-A trees of BodyParts3D, from the four tab-separated tables in `dir`. */
export function readTables(dir) {
  return { partof: readTree(dir, 'partof'), isa: readTree(dir, 'isa') };
}

function elementsOf(tables, name) {
  const isa = name.startsWith('isa:');
  const tree = isa ? tables.isa : tables.partof;
  const plain = isa ? name.slice(4) : name;
  const conceptId = tree.byName.get(plain);
  if (conceptId === undefined) throw new Error(`unknown BodyParts3D concept "${name}"`);
  return tree.elements.get(conceptId) ?? new Set();
}

/** Element file ids of the concepts, less those of `minus`, sorted. */
export function resolveElements(tables, concepts, minus = []) {
  const out = new Set();
  for (const name of concepts) for (const id of elementsOf(tables, name)) out.add(id);
  for (const name of minus) for (const id of elementsOf(tables, name)) out.delete(id);
  return [...out].sort();
}

export function mergeMeshes(list) {
  const positions = new Float32Array(list.reduce((n, m) => n + m.positions.length, 0));
  const indices = new Uint32Array(list.reduce((n, m) => n + m.indices.length, 0));
  let pAt = 0;
  let iAt = 0;
  for (const m of list) {
    const base = pAt / 3;
    positions.set(m.positions, pAt);
    for (let k = 0; k < m.indices.length; k += 1) indices[iAt + k] = m.indices[k] + base;
    pAt += m.positions.length;
    iAt += m.indices.length;
  }
  return { positions, indices };
}

export function bbox(positions) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let k = 0; k < positions.length; k += 3) {
    for (let a = 0; a < 3; a += 1) {
      min[a] = Math.min(min[a], positions[k + a]);
      max[a] = Math.max(max[a], positions[k + a]);
    }
  }
  return { min, max, centre: min.map((lo, a) => (lo + max[a]) / 2) };
}

export function triangleCount(mesh) {
  return mesh.indices.length / 3;
}

/** Smooth vertex normals of an indexed triangle mesh, each face weighted by its area; a vertex with no area gets +Y. */
export function computeNormals(positions, indices) {
  const normals = new Float32Array(positions.length);
  for (let t = 0; t < indices.length; t += 3) {
    const a = indices[t] * 3;
    const b = indices[t + 1] * 3;
    const c = indices[t + 2] * 3;
    const ux = positions[b] - positions[a];
    const uy = positions[b + 1] - positions[a + 1];
    const uz = positions[b + 2] - positions[a + 2];
    const vx = positions[c] - positions[a];
    const vy = positions[c + 1] - positions[a + 1];
    const vz = positions[c + 2] - positions[a + 2];
    // the cross product is twice the face area long, so adding it as it is weights by area
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    for (const i of [a, b, c]) {
      normals[i] += nx;
      normals[i + 1] += ny;
      normals[i + 2] += nz;
    }
  }
  for (let i = 0; i < normals.length; i += 3) {
    const len = Math.hypot(normals[i], normals[i + 1], normals[i + 2]);
    if (len > 0) {
      normals[i] /= len;
      normals[i + 1] /= len;
      normals[i + 2] /= len;
    } else normals[i + 1] = 1;
  }
  return normals;
}

/** Parse the organ map and check kinds and cross-references. */
export function readOrganMap(path) {
  const map = parse(readFileSync(path, 'utf8'));
  const organs = map.organs ?? {};
  const fits = map.fits ?? {};
  for (const [id, organ] of Object.entries(organs)) {
    if (!KINDS.includes(organ.kind)) throw new Error(`organ "${id}": unknown kind "${organ.kind}"`);
    for (const target of organ.of ?? []) {
      if (!(target in organs)) throw new Error(`organ "${id}": "of" names unknown organ "${target}"`);
    }
    if (organ.inside !== undefined && !(organ.inside in organs)) {
      throw new Error(`organ "${id}": "inside" names unknown organ "${organ.inside}"`);
    }
    if (organ.fit !== undefined && !(organ.fit in fits)) throw new Error(`organ "${id}": "fit" names unknown fit "${organ.fit}"`);
  }
  return map;
}
