// View state of the body page that needs no WebGL: hash, roles, selectable list, stepping, camera fit.
// Frame of the assets: Y up, metres, front on +Z, left on +X (docs/BODY_SPEC.md).

export type Vec3 = [number, number, number];
export type Box = { min: number[]; max: number[] };
export type ManifestOrgan = {
  system: string;
  kind: 'mesh' | 'hra' | 'proxy' | 'schematic' | 'none';
  of: string[];
  inside: string | null;
  box?: Box;
  centre?: number[];
};
export type BodyManifest = { organs: Record<string, ManifestOrgan> };
export type BodyState = { system: string | null; organ: string | null };
export type Role = 'selected' | 'system' | 'ghost' | 'idle';
export type View = 'front' | 'back' | 'side' | 'organ';

const SHELL_ORGAN = 'skin';
const FOV_DEG = 40;
const MARGIN = 1.2;

const NONE: BodyState = { system: null, organ: null };

export function parseHash(hash: string, manifest: BodyManifest): BodyState {
  const text = hash.startsWith('#') ? hash.slice(1) : hash;
  if (text.startsWith('organ-')) {
    const organ = text.slice('organ-'.length);
    const found = Object.hasOwn(manifest.organs, organ) ? manifest.organs[organ] : undefined;
    return found ? { system: found.system, organ } : { ...NONE };
  }
  if (text.startsWith('sys-')) {
    const system = text.slice('sys-'.length);
    return Object.values(manifest.organs).some((o) => o.system === system) ? { system, organ: null } : { ...NONE };
  }
  return { ...NONE };
}

export function toHash(state: BodyState): string {
  if (state.organ) return `#organ-${state.organ}`;
  if (state.system) return `#sys-${state.system}`;
  return '';
}

/** Role of every organ for the renderer, plus the organs that have no published card. */
export function roles(manifest: BodyManifest, state: BodyState, published: Set<string>): { roles: Map<string, Role>; empty: Set<string> } {
  const selected = new Set<string>();
  const containers = new Set<string>();
  const chosen = state.organ ? manifest.organs[state.organ] : undefined;
  if (state.organ && chosen) {
    selected.add(state.organ);
    for (const id of chosen.of) selected.add(id);
    for (const id of selected) {
      const container = manifest.organs[id]?.inside;
      if (container) containers.add(container);
    }
  }
  const out = new Map<string, Role>();
  const empty = new Set<string>();
  for (const [id, organ] of Object.entries(manifest.organs)) {
    if (!published.has(id)) empty.add(id);
    if (selected.has(id)) out.set(id, 'selected');
    else if (containers.has(id)) out.set(id, 'ghost');
    else if (state.system === null) out.set(id, 'idle');
    else out.set(id, organ.system === state.system ? 'system' : 'ghost');
  }
  return { roles: out, empty };
}

/** Organs the user can pick, in anatomy order. The shell counts only when the system is skin. */
export function selectable(manifest: BodyManifest, state: BodyState): string[] {
  const shellOpen = manifest.organs[SHELL_ORGAN]?.system === state.system;
  return Object.entries(manifest.organs)
    .filter(([id, organ]) => (id !== SHELL_ORGAN || shellOpen) && (state.system === null || organ.system === state.system))
    .map(([id]) => id);
}

/**
 * The systems whose files a view of `system` needs: the system itself, then the system of every organ that one of its
 * organs stands for (`of`, a proxy such as bone-marrow on the bones) or sits inside (`inside`). Without them the proxy
 * would select meshes that were never loaded.
 */
export function systemsFor(manifest: BodyManifest, system: string): string[] {
  const out = [system];
  for (const organ of Object.values(manifest.organs)) {
    if (organ.system !== system) continue;
    for (const id of [...organ.of, ...(organ.inside ? [organ.inside] : [])]) {
      const other = manifest.organs[id]?.system;
      if (other && !out.includes(other)) out.push(other);
    }
  }
  return out;
}

export function step(list: string[], current: string | null, dir: 1 | -1): string | null {
  if (list.length === 0) return null;
  const at = current === null ? -1 : list.indexOf(current);
  if (at < 0) return dir > 0 ? list[0] : list[list.length - 1];
  return list[(at + dir + list.length) % list.length];
}

/** Camera that fits the box with a margin, for a vertical field of view of 40 degrees. Portrait aspects stand farther. */
export function cameraFor(box: Box, aspect: number, view: View): { position: Vec3; target: Vec3 } {
  const size = box.max.map((v, i) => v - box.min[i]);
  const target = box.min.map((v, i) => (v + box.max[i]) / 2) as Vec3;
  const side = view === 'side';
  const width = side ? size[2] : size[0];
  const depth = side ? size[0] : size[2];
  const tan = Math.tan((FOV_DEG * Math.PI) / 360);
  const fit = Math.max(size[1] / 2 / tan, width / 2 / (tan * aspect)) * MARGIN;
  const d = fit + depth / 2;
  const [x, y, z] = target;
  const position: Vec3 = side ? [x + d, y, z] : view === 'back' ? [x, y, z - d] : [x, y, z + d];
  return { position, target };
}
