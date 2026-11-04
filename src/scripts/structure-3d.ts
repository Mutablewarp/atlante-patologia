/**
 * The heavy half of <ap-structure> (structure-viewer.ts): loaded with a dynamic
 * import only after the learner presses "Load the 3D view", so 3Dmol (~160 kB gz)
 * never counts against a page's initial JS. Structure files are local
 * (public/structures/*.bcif.gz); nothing is fetched from RCSB at runtime, and
 * 3Dmol's auto-fetching classes and data-pdb attributes are never used.
 */
import { createViewer, type AtomSelectionSpec } from '3dmol/build/3Dmol.es6-min.js';
import type { ViewerStep } from '../lib/pathways.ts';

// Colour-vision-safe pair; the legend repeats it in text and 3D labels name the part.
const GREY = '#9a9a9a';
const ORANGE = '#e66100';
/** Same as .structure-stage[data-loaded] in pathway.css. */
const STAGE = '#f6f1e7';
// 3Dmol accepts arrays for chain/resn and "170-189" for resi at runtime; its declarations are narrower.
const spec = (s: object) => s as AtomSelectionSpec;

/** gzip magic bytes: decompress here when the server did not already do it. */
async function inflate(buf: ArrayBuffer): Promise<Uint8Array> {
  const b = new Uint8Array(buf);
  if (b[0] !== 0x1f || b[1] !== 0x8b) return b;
  const stream = new Blob([b]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export type Controller = {
  /** Draws the step; resolves to the number of highlighted atoms (0 without a highlight), or -1 for a step without a structure. */
  show(step: ViewerStep): Promise<number>;
  rotate(axis: 'x' | 'y', deg: number): void;
  zoom(factor: number): void;
  reset(): void;
  labels(on: boolean): void;
};

export async function mount(el: HTMLElement, base: string, reduce: boolean): Promise<Controller> {
  const ms = reduce ? 0 : 300;
  // Opaque light backdrop in both themes: grey and orange keep >= 3:1 against it (WCAG 1.4.11); over the dark stage they did not.
  const viewer = createViewer(el, { backgroundColor: STAGE, backgroundAlpha: 1, antialias: true });
  const files = new Map<string, Uint8Array>();
  let current: string | undefined;
  let view: unknown[] | undefined;
  let label: { text: string; sel: AtomSelectionSpec } | undefined;
  let showLabels = true;

  const drawLabel = () => {
    viewer.removeAllLabels();
    if (!showLabels || !label) return;
    const atoms = viewer.selectedAtoms(label.sel);
    if (!atoms.length) return;
    const c = { x: 0, y: 0, z: 0 };
    for (const a of atoms) {
      c.x += (a.x ?? 0) / atoms.length;
      c.y += (a.y ?? 0) / atoms.length;
      c.z += (a.z ?? 0) / atoms.length;
    }
    viewer.addLabel(label.text, { position: c, inFront: true, fontSize: 14, fontColor: 'white', backgroundColor: '#1c1923', backgroundOpacity: 0.85 });
  };

  return {
    async show(step) {
      if (!step.structure || !step.file) return -1;
      if (step.structure !== current) {
        let data = files.get(step.file);
        if (!data) {
          const res = await fetch(base + step.file);
          if (!res.ok) throw new Error(`${step.file}: HTTP ${res.status}`);
          data = await inflate(await res.arrayBuffer());
          files.set(step.file, data);
        }
        viewer.removeAllModels();
        viewer.addModel(data, 'bcif');
        current = step.structure;
      }
      const scope = spec(step.show ? { chain: step.show } : {});
      const cartoon = (color: string) => ({ cartoon: step.coarse ? { style: 'trace', color, thickness: 0.6 } : { color } });
      viewer.setStyle({}, {});
      viewer.setStyle(scope, cartoon(GREY));
      const h = step.highlight;
      let count = 0;
      label = undefined;
      if (h) {
        const sel = spec({ ...scope, ...(h.chains ? { chain: h.chains } : {}), ...(h.resi ? { resi: h.resi } : {}), ...(h.resn ? { resn: h.resn } : {}) });
        // Ligands and small groups as sticks, protein parts as orange cartoon.
        viewer.setStyle(sel, h.resn ? { stick: { color: ORANGE, radius: 0.3 } } : cartoon(ORANGE));
        count = viewer.selectedAtoms(sel).length;
        label = { text: h.label, sel };
      }
      viewer.zoomTo(scope, 0);
      view = viewer.getView();
      drawLabel();
      viewer.render();
      return count;
    },
    rotate: (axis, deg) => void viewer.rotate(deg, axis, ms),
    zoom: (f) => void viewer.zoom(f, ms),
    reset: () => {
      if (view) viewer.setView(view);
      viewer.render();
    },
    labels(on) {
      showLabels = on;
      drawLabel();
      viewer.render();
    },
  };
}
