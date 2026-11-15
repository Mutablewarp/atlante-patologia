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
| Home | The home page is a short description of the atlas, then the body: stage, system chips, and a link to the full page. `/[lang]/body/` keeps the whole tree | Owner request of 2026-11-13: the body is the way into the atlas, and it must work well on a phone (this replaces plan decision D7) |
| Loading | Poster first; it already shows the body. On screens ≥ 48rem with a mouse (hover and a fine pointer) 3D starts by itself after load, when idle. On a phone and on any touch screen it starts on one tap on the poster. Never when Save-Data is on, on a 3G or slower connection, or when the learner turned 3D off | Page budget (about 120 kB of JavaScript) and Lighthouse ≥ 90 on a phone connection |
| Colour | Hematoxylin and eosin: organs in eosin tones, the selection in hematoxylin (`--eosin`, `--hema` in `src/styles/tokens.css`) | The atlas's own colour language; passes in both themes |

## 2. Sources and licences (checked at the source on 2026-11-13)

- BodyParts3D 4.0, <https://dbarchive.biosciencedbc.jp/en/bodyparts3d/download.html>. Licence page (last updated 2025/02/27): Creative Commons Attribution 4.0 International. Required credit, verbatim: "BodyParts3D, © The Database Center for Life Science licensed under CC Attribution 4.0 International". The README of the same download (License section, last updated 2025/02/25) says the same. The OBJ files themselves (release 4.0, 2013) still carry an older header in every file: "BodyParts3D, (c) The Database Center for Life Science licensed under CC Attribution-Share Alike 2.1 Japan"; the update history of the README says the licence text was updated on 2011/08/25 and again on 2025/02/27. The two texts differ (share-alike or not). The project credits the 2025 wording and distributes the derived meshes under CC BY-SA 4.0, the licence of its content, which also satisfies the share-alike term of the header; `docs/licenses/anatomy.md` records both texts. Open question for the owner: ask the database centre which text governs.
  Files: `isa_BP3D_4.0_obj_99.zip` (136 MB) and `partof_BP3D_4.0_obj_99.zip` (62 MB), plus the tables `partof_parts_list_e.txt`, `isa_parts_list_e.txt`, `partof_element_parts.txt`, `isa_element_parts.txt`. The tables list 1,258 element files in the PART-OF tree and 2,234 in the IS-A tree; every PART-OF element is also an IS-A element, so the IS-A archive should be enough (B-0 confirms on the unpacked files).
- HRA 3D Reference Object Library, release v2.5, <https://humanatlas.io/3d-reference-library>. The page states: all HRA 3D reference objects are released under CC BY 4.0. Objects built from the Visible Human male and female data. Each object has a persistent address `https://purl.humanatlas.io/ref-organ/<object>/<version>`; the page asks for a citation, which B-3 copies into the licence record.
- three.js: MIT (`npm run` licence check must pass after the install).
- Raw downloads stay in `.work/anatomy/raw/` (ignored by git). Only built files are committed.
- Licence record: `docs/licenses/anatomy.md` (source, version, date, licence, credit, changes: merged, simplified, recoloured, moved). The credit is shown under the viewer and on the licences page. The project does not claim legal compliance; it records what the sources state.

## 3. Organ map

`scripts/anatomy/organ-map.yaml` gives each of the 56 organ nodes of `src/content/anatomy.yaml` one kind: `mesh` 39, `hra` 5, `proxy` 6, `schematic` 1, `none` 5 (B-0 moved the cervix from `proxy` to `hra` and the peritoneum from `mesh` to `proxy`, section 11). It names exact BodyParts3D concepts; the build fails on an unknown name.
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
- Without JavaScript every system section is visible and the chips are in-page links. With the viewer running and a system chosen by the learner (a chip, a link, a key), only that system's section is shown, beside the stage on wide screens and under it on narrow ones. Until then, and on a deep link, every section stays visible: hiding them when 3D starts by itself would shift the page. The selected chip and organ link carry `aria-current="true"`.

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
- Loading: `showSystem(id)` loads the file of `id` and the files of the systems that its proxies stand for or sit inside (bone marrow shows the bones, which are another file); `showSystem(null)` returns at once and streams every system one at a time, the heavy ghosts (muscle, bones, breast) last, and a failure of that stream reports through `onError` while the viewer keeps what it has. A later `showSystem` cancels the stream.
- Rendering on demand: one frame per change, a loop only during a camera move. Pixel ratio capped at 2. Context loss, or a frame that throws, shows the poster and a retry button; turning 3D off or losing the context gives the next start a new canvas, because a disposed context is not reused. The label moves with `transform` only (left and top would count as layout shift).
- Buttons for every action: rotate left and right, zoom in and out, front, back, side, reset, previous and next organ, turn 3D off. Keys on the stage: arrows, `+`, `-`, `0`, `[`, `]`, `Escape` (clear). Dragging rotates and pinching zooms, but nothing needs them.
- Touch: the stage has `touch-action: pan-y`. A horizontal drag rotates, a vertical swipe scrolls the page, two fingers zoom. The stage never traps the scroll of the page.
- No auto-rotation. Camera moves ease over 400 ms with `--ease`; under `prefers-reduced-motion` they jump.
- Without WebGL, or after any error: poster, tree and a plain message. Nothing else on the page depends on the canvas.
- The choice "3D off" is stored in `localStorage` (`ap-body-3d`); nothing leaves the device.

## 7. Look

- The stage sits on `--paper`; the canvas is transparent. No dark box, no gradient backdrop.
- Shell: translucent, brightest at the silhouette (Fresnel term) in `--ink` at low alpha, so the body reads as a drawn outline with the organs inside.
- Organs: Lambert shading, one hemisphere light and one key light. Colours are read from the CSS tokens at start and again when the theme changes.
  - organs of the selected system: `--eosin`; the selected organ: `--hema`, with a thin `--ink` outline (back-face hull);
  - organs of other systems: ghost (alpha about 0.12, no depth write); with no system selected, every organ in a soft eosin tint, **except `skeletal-muscle` and `bones`, which stay ghosts until their own system is selected**: drawn solid they hide every other organ (seen in the B-3d look pass);
  - an organ with no published card is lighter (mixed towards `--surface-2`) and stays selectable.
- Label: the selected organ's name in `--font-display` with a leader line, as HTML over the canvas (crisp text, selectable, translated).
- Controls use the existing button and `.segmented` styles (`src/styles/viewer.css`, `entity.css`). Touch targets ≥ 44 px. Focus ring `--focus`.
- Phone first (below 48rem): the stage spans the width in a 4:5 box, at most 70svh. The system chips are one row that scrolls sideways with scroll snap, right under the stage, within thumb reach. The controls are one row of 44 px buttons. The organ panel rises from the bottom as a sheet (at most 60svh, a close button named after the organ, `Escape` closes; the sheet is not a modal, so there is no focus trap: `Enter` on the stage moves to the organ's card list). No horizontal scroll of the page at 320 px.
- Wide screens: stage on the left, panel on the right, chips above both.

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
| e2e, phone (375 × 812) | the home page shows the description and then the stage; one tap starts 3D; chip, then organ, then card works with taps only; the sheet opens and closes; no horizontal page scroll; layout shift 0 |
| Lighthouse | ≥ 90 on `/it/body/` and on the home page, phone profile |

WebGL in the test container: Chromium has a software renderer; Firefox and WebKit may have none, so those runs cover the fallback. A test that needs the canvas starts with `data-webgl="on"` or skips.

## 10. Out of scope for the first release

A female base body, per-organ sub-parts (lobes, segments), lesion markers inside an organ, animation, labels for every organ at once, the path from body to micrograph and molecule (plan §9).

## 11. Measured facts (B-0, 2026-11-13)

Raw data is in `.work/anatomy/raw/` (not committed). Measured with `scripts/anatomy/lib.mjs`, `scripts/anatomy/spike.mjs` and `scripts/anatomy/spike-viewer/`, and by reading the files.

| Fact | Value | How measured |
|---|---|---|
| Unpacked IS-A archive: files, triangles, units, up axis | 2,234 OBJ files (zip 142,903,898 bytes, 462 MB unpacked, passes `unzip -t`), the count of section 2. Every face is a triangle. Millimetres. **Z is up** (skin box 667 × 292 × 1,720 mm, z from −78.1 to 1,641.4), **the front is −Y**, **the patient's left is +X** (right lung centre x −55.9, left lung +72.5, spleen +84.8, liver −10.3; sternum y −172.3, spine −54.4, nose y −159.6). The 40 `mesh` organs use 1,081 element files, 4,070,572 triangles in all (skeletal muscle 2,086,974, bones 710,464, brain 322,262, shell 203,382, eyes 197,762, liver 191,622, pharynx 178,214). Each file has `v`, `vn` (one per vertex) and `f v//vn` lines and a header with concept id, name, bounds and volume | 1,081 files parsed by `lib.mjs`; box centres of named concepts |
| Frame conversion | X' = (x − cx) / 1000, Y' = (z − zmin) / 1000, Z' = −(y − cy) / 1000, with cx and cy the centre of the shell's x and y ranges and zmin its lowest z: a rotation (determinant +1), so left stays on +X and the front goes to +Z. Normals computed by `computeNormals` agree with the OBJ's own: mean dot 0.998 to 1.000, 0 % opposite (stomach, heart, skin, kidney), so the winding is outward | `spike.mjs`; scratch comparison with the `vn` lines |
| Size of the 5 test organs and the shell | Triangles (source), OBJ kB → at three targets, quantized kB, meshopt kB, meshopt kB without normals. Shell (203,382; 14,127): 8,000 / 16,000 / 30,000 → 110 / 220 / 411, **37.5 / 71.4 / 129.1**, 29.1 / 55.5 / 100.6. Heart (68,024; 4,424): 2,000 / 5,000 / 12,000 → 29 / 71 / 167, **12.1 / 27.1 / 59.1**, 9.7 / 21.5 / 46.4. Lung (114,750; 7,241): 28 / 78 / 174 → 14.1 / 28.5 / 58.8 (10.9 / 22.0 / 45.2). Liver (191,622; 12,632): 29 / 71 / 167 → 12.2 / 26.5 / 57.4 (9.6 / 20.8 / 44.9). Kidney (5,292; 314): 28 / 69 / 73 → 11.0 / 23.6 / 24.7 (8.6 / 18.6 / 19.5; 12,000 is more than the source, so 5,292). Stomach (1,810; 105): 25.8 → 10.4 (8.3), the source is below every target. So meshopt is 34 to 36 % of the quantized size, 4.4 to 7.4 bytes per triangle (small meshes cost more per triangle), and normals are 20 to 25 % of it. **Normals stay in the files**: the viewer needs them, and computing them on a phone saves about a fifth of the bytes for CPU time | `node scripts/anatomy/spike.mjs`, 18 cases, files in `.work/anatomy/spike/` |
| Triangle targets | See the list below the table. About 237,800 triangles for the whole body (budget 250,000), about 1.3 MB of files (budget 6 MB), no system file above 30,000 triangles (about 160 kB; budget 500 kB each) | sums of the list and the bytes per triangle above |
| `body-3d` chunk | Spike viewer, Vite 8 library mode, one file: **765,654 bytes minified, 173,496 bytes gzip** (three's WebGLRenderer, GLTFLoader, the meshopt decoder with its embedded wasm, Lambert, Basic and one ShaderMaterial, Raycaster; 173 lines of code). **Pinned limit for B-4d: 192,000 bytes gzip** (the spike plus about 18 kB for the controller, labels and view state); the ceiling stays 200,000 | `node scripts/anatomy/spike-viewer/build.mjs` |
| Frame rate while rotating | iPad Pro 11-inch (M5) simulator, Safari, iOS 27, on the Mac's GPU, full-width canvas (1,668 px): **58.7 fps average over 5 s** (the display limit is 60) with the shell at 16,000 and five organs at 5,000 triangles, about 41,000 in all. **Not measured**: desktop at 1024 × 768 (the app's browser pane was hidden, so its timing would be wrong), the whole body at about 238,000 triangles, a real iPad or phone. To repeat on the real viewer in B-4 and B-9, and on the owner's device in B-8 | `?spin=1` of the spike viewer, screenshot of the simulator |
| HRA uterus object | `uterus-female/v1.2`: 12 nodes, 11 meshes, 40,950 triangles, 980,408 bytes. Roots `VH_F_cervicovaginal_junction` and `VH_F_uterus`; under the uterus: abdominal ostium of uterine tube, body, fundus, cornua, lower uterine segment, posterior wall, anterior wall, and `VH_F_cervix` with children `VH_F_internal_cervical_os` and `VH_F_external_cervical_os`. **A cervix is present, a vagina is not** (only the cervicovaginal junction). So `uterine-cervix` is `hra`, and `vagina` stays `none` | node list read from the GLB's JSON chunk |
| All ten HRA objects | Downloaded from the address each purl page names (`cdn.humanatlas.io/.../assets/*.glb`), all CC BY 4.0 on their pages. Metres, no node transforms, **Y up, +Z front, +X patient's left** (nipples at +z, sacrum at −z, left ovary at +x): the frame of section 4, so a fit needs only a translation and one scale. Triangles: pelvis 87,448 (24 nodes), sternum 8,526, manubrium 5,036, tubes 18,281 and 17,770, ovaries 424 and 410, mammary glands 270,799 and 585,330 (13.7 and 24.4 MB, 8 meshes each) | `.work/anatomy/raw/hra/`, node lists |
| BodyParts3D `peritoneum` | Three elements: FJ3396 "Mesentery of small intestine" (FMA14643, 38,274 triangles), FJ3397 "Mesoappendix" (FMA16549, 1,388), FJ3398 "Transverse mesocolon" (FMA14647, 1,484). They are folds of the peritoneum, not its lining, so `peritoneum` becomes a `proxy` of small-intestine and colon | the header lines of the three OBJ files |

Triangle targets (B-3a puts them in one table at the top of `build-body.mjs`; B-3d changes a number when the look asks for it): shell 24,000; heart 12,000, lung 12,000, liver 12,000, brain 12,000, bones 24,000, skeletal-muscle 24,000, lower-limb-veins 6,000, trachea-bronchi 6,000, oral-cavity 6,000, small-intestine 8,000, colon 8,000, pancreas 5,000, kidney 5,292 (the source), aorta 4,000, heart-valves 4,000, adrenal-gland 4,000, nasal-cavity-sinuses 4,000, pharynx 4,000, larynx 4,000, eye 4,000, gallbladder-bile-ducts 3,000; every other `mesh` organ keeps its source count (all at most 3,998); HRA objects: uterus 3,000, uterine-cervix 1,500, fallopian-tube 3,000, ovary as the source (834), breast 3,000 for each side; thyroid (schematic) about 320.

Look pass (B-3d, 2026-11-14), on the real build rendered in the spike viewer, one close view per system and the whole body from front and side: the frame and the orientation are right (arms at the sides, feet at 0, left on +X). Skeleton, heart with coronary vessels, stomach and intestines, liver and bile ducts, brain, kidneys, urinary tract, uterus with tubes and breasts (HRA, fitted) are recognisable. Two findings. (1) **BodyParts3D has no lung surface**: its `right lung` and `left lung` (280 elements) and their lobes are segmental bronchial trees and segmental vessels, so `lung` shows as an airway and vessel tree, not as a lung; `docs/REVIEW_QUEUE.md` has the row, and a schematic envelope of the tree would be the fix (owner decision). (2) Skeletal muscle hides every other organ in the whole-body view: it is a ghost there (section 7). With the HRA organs and the thyroid the build is 17 system files plus the shell, about 1.2 MB, manifest 11,190 bytes of 12,000 (the next organ will need the budget raised to 16 kB). The pelvis fit carries an offset of 12 mm back (`organ-map.yaml`), found by the placement test: without it the uterus came out 0.4 mm in front of the male bladder centre. The viewer run of B-4b (2026-11-14, headless Chromium with software WebGL) then showed two more things. First, the skeleton had no limb bones: the PART-OF concept `skeletal system` (138 elements) holds the axial skeleton and the girdles, the IS-A `bone organ` (203) holds the long bones, and the union is 262 elements; `bones` now uses both, still at 24,000 triangles (`bone-soft-tissue.glb` 108,156 bytes, the `bones` box now spans the feet to the head). Second, in the whole-body view the breasts (a solid HRA envelope) hid the chest, so `breast` is a ghost there like muscle and bones, and the muscle ghost is fainter (alpha 0.04) because hundreds of overlapping muscles at 0.12 made a fog over the organ in front of the camera.
