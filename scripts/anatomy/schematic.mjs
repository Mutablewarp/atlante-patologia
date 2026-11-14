// Hand-built shapes for organs that BodyParts3D does not model (docs/BODY_SPEC.md §3, kind `schematic`).

/**
 * UV ellipsoid with single poles, 2 * segments * (rings - 1) triangles, wound outward.
 * @param {number[]} centre
 * @param {number[]} radii
 * @param {number} segments
 * @param {number} rings
 */
function ellipsoid([cx, cy, cz], [rx, ry, rz], segments, rings) {
  const positions = [cx, cy + ry, cz];
  for (let i = 1; i < rings; i += 1) {
    const theta = (Math.PI * i) / rings;
    for (let j = 0; j < segments; j += 1) {
      const phi = (2 * Math.PI * j) / segments;
      positions.push(cx + rx * Math.sin(theta) * Math.cos(phi), cy + ry * Math.cos(theta), cz + rz * Math.sin(theta) * Math.sin(phi));
    }
  }
  positions.push(cx, cy - ry, cz);
  const bottom = positions.length / 3 - 1;
  const ring = (i, j) => 1 + (i - 1) * segments + (j % segments);
  const indices = [];
  for (let j = 0; j < segments; j += 1) {
    indices.push(0, ring(1, j + 1), ring(1, j));
    indices.push(bottom, ring(rings - 1, j), ring(rings - 1, j + 1));
  }
  for (let i = 1; i < rings - 1; i += 1) {
    for (let j = 0; j < segments; j += 1) {
      const a = ring(i, j);
      const b = ring(i, j + 1);
      const c = ring(i + 1, j);
      const d = ring(i + 1, j + 1);
      indices.push(a, b, c, b, d, c);
    }
  }
  return { positions, indices };
}

/**
 * Two lobes and an isthmus, in front of the trachea and just below the thyroid cartilage; every size is a multiple of the
 * tracheal width. About 300 triangles. Boxes are in the frame of spec §4 (X left, Y up, Z front).
 * @param {{ cartilage: { min: number[], max: number[] }, trachea: { min: number[], max: number[] } }} anchors
 * @returns {{ positions: Float32Array, indices: Uint32Array }}
 */
export function twoLobesIsthmus({ cartilage, trachea }) {
  const w = trachea.max[0] - trachea.min[0];
  const cx = (trachea.min[0] + trachea.max[0]) / 2;
  const sy = w;
  // the cartilage sets the top of the lobes; the lobes never rise above the trachea's upper end
  const cy = Math.min(cartilage.min[1], trachea.max[1]) - sy;
  const cz = trachea.max[2] + 0.25 * w;
  const parts = [
    ellipsoid([cx - 0.75 * w, cy, cz], [0.45 * w, sy, 0.5 * w], 12, 6),
    ellipsoid([cx + 0.75 * w, cy, cz], [0.45 * w, sy, 0.5 * w], 12, 6),
    ellipsoid([cx, cy - 0.5 * sy, cz], [0.9 * w, 0.15 * w, 0.3 * w], 8, 5),
  ];
  const positions = [];
  const indices = [];
  for (const part of parts) {
    const base = positions.length / 3;
    positions.push(...part.positions);
    for (const i of part.indices) indices.push(i + base);
  }
  return { positions: new Float32Array(positions), indices: new Uint32Array(indices) };
}
