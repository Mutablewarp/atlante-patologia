// HRA 3D reference objects: reading a glb and the landmark fit into the BodyParts3D frame (docs/BODY_SPEC.md §9).
import { join } from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { mergeMeshes } from './lib.mjs';

/**
 * One scale (ratio of the box diagonals) and a translation that moves `fromBox` onto `toBox`.
 * `centre`: the box centres coincide. `front`: the centres coincide on X and Y and the maximum-Z faces coincide.
 * @param {{ min: number[], max: number[] }} fromBox
 * @param {{ min: number[], max: number[] }} toBox
 * @param {'centre' | 'front'} anchor
 * @returns {{ scale: number, translate: number[] }}
 */
export function fitTransform(fromBox, toBox, anchor = 'centre') {
  if (anchor !== 'centre' && anchor !== 'front') throw new Error(`unknown fit anchor "${anchor}"`);
  const diagonal = (b) => Math.hypot(...b.max.map((v, a) => v - b.min[a]));
  const scale = diagonal(toBox) / diagonal(fromBox);
  const centre = (b) => b.min.map((lo, a) => (lo + b.max[a]) / 2);
  const [fc, tc] = [centre(fromBox), centre(toBox)];
  const translate = tc.map((v, a) => v - fc[a] * scale);
  if (anchor === 'front') translate[2] = toBox.max[2] - fromBox.max[2] * scale;
  return { scale, translate };
}

/** Path of the glb of an HRA object such as `uterus-female/v1.2`. */
export function hraFile(dir, object) {
  return join(dir, `${object.replaceAll('/', '_')}.glb`);
}

/**
 * Read a glb, apply the world matrix of each node and merge the meshes of all nodes, or of the named ones (metres).
 * @param {string} path
 * @param {string[]} [nodes]
 * @returns {Promise<{ positions: Float32Array, indices: Uint32Array }>}
 */
export async function loadHra(path, nodes) {
  const doc = await new NodeIO().read(path);
  const wanted = nodes?.length ? new Set(nodes) : undefined;
  const parts = [];
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh();
    if (!mesh || (wanted && !wanted.has(node.getName()))) continue;
    const m = node.getWorldMatrix();
    for (const prim of mesh.listPrimitives()) {
      const src = prim.getAttribute('POSITION')?.getArray();
      if (!src) continue;
      const positions = new Float32Array(src.length);
      for (let k = 0; k < src.length; k += 3) {
        const [x, y, z] = [src[k], src[k + 1], src[k + 2]];
        positions[k] = m[0] * x + m[4] * y + m[8] * z + m[12];
        positions[k + 1] = m[1] * x + m[5] * y + m[9] * z + m[13];
        positions[k + 2] = m[2] * x + m[6] * y + m[10] * z + m[14];
      }
      const index = prim.getIndices()?.getArray();
      parts.push({ positions, indices: index ? Uint32Array.from(index) : Uint32Array.from({ length: positions.length / 3 }, (_, i) => i) });
    }
  }
  if (parts.length === 0) throw new Error(`${path}: no mesh node${wanted ? ` among ${[...wanted].join(', ')}` : ''}`);
  return mergeMeshes(parts);
}
