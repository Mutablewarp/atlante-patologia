/**
 * Build-time layout for the concept map (NAVIGATION_SPEC §5): a deterministic
 * Fruchterman–Reingold force layout, so the page ships a static SVG with no
 * runtime library and no animation.
 */
export type GraphEdge = { from: string; to: string };
export type Point = { x: number; y: number };

export function forceLayout(
  ids: readonly string[],
  edges: readonly GraphEdge[],
  size = { w: 1000, h: 700 },
  iterations = 300,
): Map<string, Point> {
  const n = ids.length;
  const pos = new Map<string, Point>();
  if (n === 0) return pos;
  const cx = size.w / 2;
  const cy = size.h / 2;
  // Start on a circle (deterministic: no randomness).
  ids.forEach((id, i) => {
    const a = (2 * Math.PI * i) / n;
    pos.set(id, { x: cx + (size.w / 3) * Math.cos(a), y: cy + (size.h / 3) * Math.sin(a) });
  });
  if (n === 1) return new Map([[ids[0]!, { x: cx, y: cy }]]);

  const k = Math.sqrt((size.w * size.h) / n) * 0.6;
  const valid = edges.filter((e) => pos.has(e.from) && pos.has(e.to) && e.from !== e.to);
  let temp = size.w / 10;
  for (let it = 0; it < iterations; it++) {
    const disp = new Map(ids.map((id) => [id, { x: 0, y: 0 }]));
    for (let i = 0; i < n; i++)
      for (let j = i + 1; j < n; j++) {
        const a = pos.get(ids[i]!)!;
        const b = pos.get(ids[j]!)!;
        const dx = a.x - b.x || 0.01;
        const dy = a.y - b.y || 0.01;
        const d = Math.max(Math.hypot(dx, dy), 0.01);
        const f = (k * k) / d;
        const da = disp.get(ids[i]!)!;
        const db = disp.get(ids[j]!)!;
        da.x += (dx / d) * f;
        da.y += (dy / d) * f;
        db.x -= (dx / d) * f;
        db.y -= (dy / d) * f;
      }
    for (const e of valid) {
      const a = pos.get(e.from)!;
      const b = pos.get(e.to)!;
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      const d = Math.max(Math.hypot(dx, dy), 0.01);
      const f = (d * d) / k;
      disp.get(e.from)!.x -= (dx / d) * f;
      disp.get(e.from)!.y -= (dy / d) * f;
      disp.get(e.to)!.x += (dx / d) * f;
      disp.get(e.to)!.y += (dy / d) * f;
    }
    for (const id of ids) {
      const p = pos.get(id)!;
      const d = disp.get(id)!;
      // Weak gravity keeps disconnected nodes on screen.
      d.x += (cx - p.x) * 0.05;
      d.y += (cy - p.y) * 0.05;
      const len = Math.max(Math.hypot(d.x, d.y), 0.01);
      p.x += (d.x / len) * Math.min(len, temp);
      p.y += (d.y / len) * Math.min(len, temp);
    }
    temp *= 0.98;
  }
  // Fit into the box with a margin for labels.
  const xs = [...pos.values()].map((p) => p.x);
  const ys = [...pos.values()].map((p) => p.y);
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  // Wider side margins: labels are centred on the node and run sideways.
  const mx = Math.min(150, size.w / 4);
  const my = Math.min(60, size.h / 4);
  const sx = (size.w - 2 * mx) / Math.max(maxX - minX, 1);
  const sy = (size.h - 2 * my) / Math.max(maxY - minY, 1);
  for (const p of pos.values()) {
    p.x = Math.round(mx + (p.x - minX) * sx);
    p.y = Math.round(my + (p.y - minY) * sy);
  }
  return pos;
}
