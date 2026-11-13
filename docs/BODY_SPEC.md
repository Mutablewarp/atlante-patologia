# Interactive body: binding spec

Status: decisions fixed on 2026-11-13; section 11 holds the numbers that task B-0 measures. Plan: `plan/v3-plan.md` §8. Tasks: `plan/body-tasks.md`.
Purpose: the learner studies pathology by organ system. They open a body, pick a system, pick an organ, see its lesions, and open a card.

## 1. Decisions

| Topic | Decision | Why |
|---|---|---|
| Library | three.js from npm (`three`, MIT), bundled and self-hosted, imported only when the viewer starts | Standard WebGL library. No CDN: the site works offline and makes no third-party request |
| Not used | BioRender or any proprietary illustration tool | Its licence is proprietary; the project allows only original, public-domain, CC0, CC BY and CC BY-SA assets |
| Base body | BodyParts3D 4.0, one adult male body in one coordinate frame | Widest organ coverage under CC BY 4.0 |
| Female organs, breast | HRA 3D reference objects (female), fitted into the base body by landmarks | BodyParts3D has none. The page says the base body is male and these organs are fitted |
| Organs without a model | `proxy`, `schematic` or `none` in `scripts/anatomy/organ-map.yaml`; the page always says which | Honest about what the model shows (accuracy comes first) |
| Primary interface | The server-rendered tree (system, organ, cards). The canvas mirrors its selection | Works without JavaScript, without WebGL, with a keyboard and a screen reader |
| State | The URL hash: `#sys-<system>` or `#organ-<organ>` | Back, links and no-JavaScript jumps work with no extra code |
| Loading | Poster first. 3D starts on a button; on screens ≥ 48rem it starts by itself when idle, unless the learner turned it off or Save-Data is on | Page budget (about 120 kB of JavaScript) and Lighthouse ≥ 90 |
| Colour | Hematoxylin and eosin: organs in eosin tones, the selection in hematoxylin (`--eosin`, `--hema` in `src/styles/tokens.css`) | The atlas's own colour language; passes in both themes |

## 2. Sources and licences (checked at the source on 2026-11-13)

- BodyParts3D 4.0, <https://dbarchive.biosciencedbc.jp/en/bodyparts3d/download.html>. Licence page (last updated 2025/02/27): Creative Commons Attribution 4.0 International. Required credit, verbatim: "BodyParts3D, © The Database Center for Life Science licensed under CC Attribution 4.0 International".
  Files: `isa_BP3D_4.0_obj_99.zip` (136 MB) and `partof_BP3D_4.0_obj_99.zip` (62 MB), plus the tables `partof_parts_list_e.txt`, `isa_parts_list_e.txt`, `partof_element_parts.txt`, `isa_element_parts.txt`. The tables list 1,258 element files in the PART-OF tree and 2,234 in the IS-A tree; every PART-OF element is also an IS-A element, so the IS-A archive should be enough (B-0 confirms on the unpacked files).
- HRA 3D Reference Object Library, release v2.5, <https://humanatlas.io/3d-reference-library>. The page states: all HRA 3D reference objects are released under CC BY 4.0. Objects built from the Visible Human male and female data. Each object has a persistent address `https://purl.humanatlas.io/ref-organ/<object>/<version>`; the page asks for a citation, which B-3 copies into the licence record.
- three.js: MIT (`npm run` licence check must pass after the install).
- Raw downloads stay in `.work/anatomy/raw/` (ignored by git). Only built files are committed.
- Licence record: `docs/licenses/anatomy.md` (source, version, date, licence, credit, changes: merged, simplified, recoloured, moved). The credit is shown under the viewer and on the licences page. The project does not claim legal compliance; it records what the sources state.

## 3. Organ map

`scripts/anatomy/organ-map.yaml` gives each of the 56 organ nodes of `src/content/anatomy.yaml` one kind: `mesh` 40, `hra` 4, `proxy` 6, `schematic` 1, `none` 5. It names exact BodyParts3D concepts; the build fails on an unknown name.
Text the page shows next to an organ, by kind (both languages, in `src/i18n/body.ts`):
- `hra`: "Fitted from a female reference model; the base body is male."
- `proxy`: "No model of its own: shown on {organs}."
- `schematic`: "Schematic shape, not a scan."
- `none`: "No 3D model yet."

## 4. Assets

`scripts/anatomy/build-body.mjs` (Node, run by hand, not in CI) reads the organ map, the tables and the raw files, and writes `public/anatomy/`:

| File | Content | Budget (bytes on disk) |
|---|---|---|
| `shell.glb` | body surface | ≤ 400 kB |
| `<system>.glb`, one per anatomical system with at least one mesh | one mesh per organ, named by the organ id | ≤ 500 kB each |
| `manifest.json` | per system: file, bytes, triangles, organs; per organ: kind, `of`, `inside`, bounding box, centre | ≤ 12 kB |
| `poster-light.avif`, `poster-dark.avif` (+ `.webp`) | the front view, captured once from the viewer | ≤ 60 kB each |

- All files together ≤ 6 MB. Triangles on screen in the worst case ≤ 250,000.
- Steps per organ: union of the element files, weld, simplify (meshoptimizer) to the triangle target of section 11, recompute normals, quantize, compress with `EXT_meshopt_compression` (GitHub Pages does not compress `.glb` in transit, so the file must be small by itself).
- Frame: glTF, Y up, metres, body centred on X and Z, feet at Y = 0. Left and right organs of a pair are one mesh.
- HRA objects: the `fit` of the organ map gives translation and one scale from the bounding boxes of the landmark pair. Placement tests are numeric (section 9).
- Build tools are `devDependencies`: `@gltf-transform/core`, `@gltf-transform/extensions`, `@gltf-transform/functions`, `meshoptimizer`.

## 5. Page and DOM contract

Route `/[lang]/body/` (`src/pages/[lang]/body/index.astro`), linked from the Atlas page. The viewer and the tests rely on this markup:

```html
<ap-body data-manifest="…/anatomy/manifest.json">
  <figure class="body-stage" data-stage tabindex="0" aria-label="…" aria-describedby="body-help">
    <picture data-poster>…</picture>            <!-- fixed aspect-ratio box: no layout shift -->
    <canvas data-canvas hidden></canvas>
    <p class="body-label" data-label hidden></p> <!-- name of the selected organ, with a leader line -->
  </figure>
  <div class="body-controls" role="group" aria-label="…"> <button data-load>…</button> <button data-act="left">…</button> … </div>
  <p data-status role="status"></p>
  <nav class="body-systems" aria-label="…"> <a href="#sys-heart" data-system="heart">Heart <span class="count">3</span></a> … </nav>
  <section id="sys-heart" data-system="heart">
    <h2>…</h2>
    <section id="organ-heart" data-organ="heart" data-kind="mesh">
      <h3><a href="#organ-heart">Heart</a></h3> <p class="body-note">…</p>
      <ul class="body-cards"> <li><a href="…/e/<id>/">Name</a> <span>one-line definition</span></li> </ul>
    </section>
    <section class="body-planned"> <h3>…</h3> <ul> <li>Name <span class="badge badge-planned">…</span></li> </ul> </section>
  </section>
</ap-body>
```

- Cards under an organ are grouped by `process` term and sorted in syllabus order. A count sits next to each system and organ.
- A published card maps to organs by `organsOfCard` (`src/lib/anatomy.ts`). A planned card has no organ yet: it is listed once under its system (module `o16`–`o33` ↔ system, an explicit map in `src/lib/anatomy.ts`).
- Cards of `general` and `systemic` without `sites` are not on the body: one closing section links to those two lenses.
- Without JavaScript every system section is visible and the chips are in-page links. With the viewer running, only the selected system's section is shown, beside the stage on wide screens and under it on narrow ones.

## 6. Viewer

`<ap-body>` in `src/scripts/body-viewer.ts` (wiring, no three.js) and `src/scripts/body-3d.ts` (three.js, loaded by `import()`), the same split as `structure-viewer.ts` and `structure-3d.ts`.

```ts
// body-3d.ts
export type Controller = {
  showSystem(id: string | null): Promise<void>; // loads <system>.glb on first use; null = whole body
  select(organ: string | null): void;           // highlight, ghost what hides it, label, camera
  pick(x: number, y: number): string | null;    // organ under a canvas point, among the selectable ones
  act(name: 'left' | 'right' | 'up' | 'down' | 'in' | 'out' | 'reset' | 'front' | 'back' | 'side'): void;
  organs(): string[];                           // selectable organs, in anatomy order
  dispose(): void;
};
export function mount(canvas: HTMLCanvasElement, opts: { manifestUrl: string; reducedMotion: boolean; colors: Record<string, string> }): Promise<Controller>;
```

- Selection flows one way: a click in the tree, a tap on the canvas, a key or a link changes `location.hash`; `hashchange` drives tree and canvas. `<ap-body>` reflects it in `data-system`, `data-organ` and `data-webgl="on|off"` (tests read these).
- Picking: ray against the organ meshes of the selected system (all systems when none is selected). A tap is a pointer that moved less than 6 px. The shell is pickable only when the system is `skin`.
- An organ of kind `proxy` selects the meshes in `of`. `inside` ghosts the container. `none` selects nothing and the status line says so.
- Rendering on demand: one frame per change, a loop only during a camera move. Pixel ratio capped at 2. Context loss shows the poster and a retry button.
- Buttons for every action: rotate left and right, zoom in and out, front, back, side, reset, previous and next organ, turn 3D off. Keys on the stage: arrows, `+`, `-`, `0`, `[`, `]`, `Escape` (clear). Dragging rotates and pinching zooms, but nothing needs them.
- No auto-rotation. Camera moves ease over 400 ms with `--ease`; under `prefers-reduced-motion` they jump.
- Without WebGL, or after any error: poster, tree and a plain message. Nothing else on the page depends on the canvas.
- The choice "3D off" is stored in `localStorage` (`ap-body-3d`); nothing leaves the device.

## 7. Look

- The stage sits on `--paper`; the canvas is transparent. No dark box, no gradient backdrop.
- Shell: translucent, brightest at the silhouette (Fresnel term) in `--ink` at low alpha, so the body reads as a drawn outline with the organs inside.
- Organs: Lambert shading, one hemisphere light and one key light. Colours are read from the CSS tokens at start and again when the theme changes.
  - organs of the selected system: `--eosin`; the selected organ: `--hema`, with a thin `--ink` outline (back-face hull);
  - organs of other systems: ghost (alpha about 0.12, no depth write); with no system selected, every organ in a soft eosin tint;
  - an organ with no published card is lighter (mixed towards `--surface-2`) and stays selectable.
- Label: the selected organ's name in `--font-display` with a leader line, as HTML over the canvas (crisp text, selectable, translated).
- Controls use the existing button and `.segmented` styles (`src/styles/viewer.css`, `entity.css`). Touch targets ≥ 44 px. Focus ring `--focus`.

## 8. Cards and progress

- B-6, on every card: "Where in the body" lists the card's organs as links to `/[lang]/body/#organ-<id>`. A general process with `sites` lists each organ.
- B-7: the tree shows seen, mastered and due per organ from the existing learner database (`src/lib` study code; no new store). "Review this organ" opens a study session filtered by that organ's cards.

## 9. Tests and budgets

| Kind | What |
|---|---|
| Unit | the organ map covers every organ of `anatomy.yaml` and only those; every concept resolves (skipped when the raw tables are absent); `manifest.json` matches the map; every card resolves to at least one organ or to general |
| Unit, placement | uterus centre inside the pelvis box, behind the bladder centre and in front of the rectum centre; ovaries lateral to the uterus; breasts in front of the sternum; thyroid in front of the trachea and below the thyroid cartilage |
| dist | file budgets of section 4; the `body-3d` chunk is not in the service-worker shell and its gzip size ≤ the number pinned in section 11 (ceiling 200 kB) |
| e2e | tree and `data-organ` stay in sync; keyboard path from chip to card; no-WebGL path; reduced motion; no layout shift when the canvas replaces the poster; axe; Back restores the selection |
| Lighthouse | ≥ 90 on `/it/body/` |

WebGL in the test container: Chromium has a software renderer; Firefox and WebKit may have none, so those runs cover the fallback. A test that needs the canvas starts with `data-webgl="on"` or skips.

## 10. Out of scope for the first release

A female base body, per-organ sub-parts (lobes, segments), lesion markers inside an organ, animation, labels for every organ at once, the path from body to micrograph and molecule (plan §9).

## 11. Measured facts (B-0 fills this table; until then the budgets of section 4 are the limits)

| Fact | Value | How measured |
|---|---|---|
| Unpacked IS-A archive: files, total triangles, units, up axis | | |
| Triangle target: shell, small organ, large organ, a whole system | | |
| Size of 5 test organs: raw, simplified, quantized, meshopt | | |
| `body-3d` chunk: minified and gzip | | |
| Frame rate while rotating, 1024 × 768, desktop and iPad simulator | | |
| HRA uterus object: node names (cervix, vagina present?) | | |
| BodyParts3D `peritoneum`: what the 3 elements are | | |
