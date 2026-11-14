# Interactive body: tasks for the lead and the coder agents

Spec: `docs/BODY_SPEC.md` (binding). Plan: `plan/v3-plan.md` §8. Organ map: `scripts/anatomy/organ-map.yaml`.
Branch `feat/body`, worktree `../atlante-patologia-wt/body`. The lead is the session that runs this file; coder agents are lean Sonnet 5.5 runs.

## How to run

- A task marked **(coder)** is run with `node scripts/agent/run-task.mjs <id>` from the worktree. The script gives the agent this task's section and `docs/agents/roles/coder.md`, lets it write only the paths on the task's `Files:` line, checks that afterwards, and logs the cost in `.work/usage.jsonl`. Exit code 0 done, 1 blocked, 3 usage limit (run the same command again after the reset).
- Tasks with no dependency between them may run at the same time: `node scripts/agent/run-task.mjs B-0b --siblings B-0d` (each names the others, so that their files are not a violation).
- A task marked **(lead)** is done by the lead itself.
- After every coder task the lead reads the diff, runs the task's `Acceptance` commands, and commits (`feat(body): …` or `test(body): …`, one task per commit). A blocked task: read `.work/reports/<id>.coder.json`, fix the brief or split the task, run again. Never loosen a test to pass.
- Before a merge into `main`: `npm run check`, `npm test`, `npm run build`, `npm run test:dist`, `npm run guard`, `npm run contrast`, `npm run no-verbatim`, `npm run test:e2e:linux`. After the push: CI green, then the live smoke test (see `docs/OPERATIONS.md`).
- Record each finished task in `docs/PROGRESS.md` (section "Interactive body") and keep the session memory current.
- Order: B-0 → B-2 (merge 1: the page) → B-3 → B-4 → B-5 → B-9 (merge 2: the 3D viewer, on the home page and on a phone) → B-6 → B-7 (merge 3) → B-8 (merge 4). B-2 does not wait for B-0.
- Owner request of 2026-11-13 (spec §1, §6, §7, §9 amended): the home page is a short description and then the body, and it must work well on a phone. Phone layout is the first layout of every body task; B-9 puts the body on the home page.

## Setup (lead, once)

1. In the worktree: `git merge --ff-only main`; link the shared work folder: `ln -s ../../atlante-patologia/.work .work` (it is in `.git/info/exclude`).
2. Give the worktree its own modules (do not install through a link to the main checkout's): remove a `node_modules` link if present, then `npm ci`, `npm i three`, `npm i -D @types/three @gltf-transform/core @gltf-transform/extensions @gltf-transform/functions meshoptimizer`. Run the licence check the repository already has (`npm run` shows it); every new package must pass. Commit `package.json` and the lock file.
3. Raw data, into `.work/anatomy/raw/` (never committed): `bodyparts3d/isa_BP3D_4.0_obj_99.zip` (136 MB) from the download page named in the spec §2, unpacked into `bodyparts3d/isa_obj/`; the four tables are already in `bodyparts3d/`. The HRA objects named in the organ map (uterus, ovaries, fallopian tubes, mammary glands, pelvis, sternum, manubrium; all female), each from its `purl.humanatlas.io/ref-organ/<object>/<version>` page, into `hra/`. Write file names, sizes and `shasum -a 256` into `.work/anatomy/raw/SOURCES.txt`. Do not guess a download address: follow the link on the page.

## B-0: spike and measured facts

### B-0a: inspect the raw data (lead)
Count the unpacked files and compare with 2,234. Read one OBJ: units, axes (which axis is height: use the bounding box of `skin`), vertex and face counts. Sum the triangles of the 40 `mesh` organs. Open the HRA uterus object and list its node names (is there a cervix, a vagina?). Look at the three elements of `peritoneum`. Write the answers into spec §11.

### B-0b: mesh library (coder)
Files: scripts/anatomy/lib.mjs, tests/anatomy-lib.test.ts
Goal: the pure functions the spike and the build share.
Do:
- `parseObj(text)` → `{ positions: Float32Array, indices: Uint32Array }` (only `v` and `f` lines; faces with more than 3 corners are fanned; `v/vt/vn` corners; negative indices).
- `readTables(dir)` → `{ partof, isa }`, each `{ byName: Map<name, conceptId>, elements: Map<conceptId, Set<elementFileId>> }`, from the four tab-separated tables (first line is a header).
- `resolveElements(tables, concepts, minus = [])` → sorted element file ids. A name with the prefix `isa:` is looked up in the IS-A tree, any other in the PART-OF tree. An unknown name throws an error that quotes the name.
- `mergeMeshes(list)` → one mesh; `bbox(positions)` → `{ min, max, centre }`; `triangleCount(mesh)`.
- `readOrganMap(path)` → the parsed organ map, after checking: every `kind` is one of mesh, hra, proxy, schematic, none; `of` and `inside` name organs of the map; `fit` names an entry of `fits`.
Acceptance: `npx vitest run tests/anatomy-lib.test.ts` passes with small handwritten fixtures (no raw data needed); one more test, skipped when `.work/anatomy/raw/bodyparts3d/partof_parts_list_e.txt` is absent, resolves every concept of the real organ map.

### B-0c: size spike (coder)
Depends: B-0b, setup step 3
Files: scripts/anatomy/spike.mjs, tests/anatomy-spike.test.ts
Goal: measure how small five organs and the shell get.
Do: `node scripts/anatomy/spike.mjs --raw <dir of OBJ files> --tables <dir> --out .work/anatomy/spike` builds heart, lung, liver, kidney, stomach and the shell from the organ map at three triangle targets each (shell 8k, 16k, 30k; organs 2k, 5k, 12k), with `@gltf-transform/functions` (weld, simplify with `MeshoptSimplifier`, quantize, then meshopt compression) and writes each as `.glb` twice: quantized only, and quantized plus `EXT_meshopt_compression`. Print one JSON array: organ, target, triangles, bytes of the source OBJ files, bytes of both outputs. Convert to the frame of spec §4 with a proper rotation, never a mirror. Measured in B-0a: the source is millimetres, Z up, the front at −Y, the patient's left at +X. So X' = (x − cx) / 1000, Y' = (z − zmin) / 1000, Z' = −(y − cy) / 1000, where cx is the centre of the shell's x range, cy the centre of its y range and zmin its lowest z; the same three numbers for every organ and for the shell.
Acceptance: `npx vitest run tests/anatomy-spike.test.ts` builds one fixture organ and reads the `.glb` back (mesh name is the organ id; triangle count ≤ target). The lead runs the real spike and pastes the table into spec §11.

### B-0d: spike viewer (coder)
Depends: setup step 2
Files: scripts/anatomy/spike-viewer/
Goal: see the spike meshes with the look of spec §7 and measure the three.js chunk and the frame rate.
Do: `index.html`, `main.js` and `build.mjs` (use the JS API of Vite, which Astro installs: `import { build } from 'vite'` with `configFile: false`, `build.lib = { entry: <main.js>, formats: ['es'], fileName: () => 'main.js' }`, `outDir: 'dist'`, `minify: true`, one output file; esbuild is not installed and no package may be added). `main.js` loads every `.glb` of `./assets/` with `GLTFLoader` and the meshopt decoder that ships with three, draws the shell with the Fresnel look and the organs in the eosin and hematoxylin colours (hard-coded copies of the token values of both themes; a `?theme=dark` switch), buttons to rotate, zoom and reset, click to select an organ, and a frame-rate readout while rotating (`?spin=1` rotates for 5 s and prints the average). Render on demand as in spec §6. `build.mjs` bundles `main.js` into `dist/`, prints the minified and gzip bytes, and copies `index.html`. Import only what is used (`three` named imports, `three/addons/loaders/GLTFLoader.js`, `three/addons/libs/meshopt_decoder.module.js`).
Acceptance: `node scripts/anatomy/spike-viewer/build.mjs` prints the two sizes. The lead copies the spike `.glb` files into `dist/assets/`, serves `dist/` (add a `body-spike` entry to `.claude/launch.json`), measures at 1024 × 768 and on an iPad simulator, and takes screenshots in both themes.

### B-0e: decide and record (lead)
Fill spec §11. Choose the triangle targets so that every budget of spec §4 holds; if the `body-3d` chunk would pass 200 kB gzip, stop and report to the owner. Add the measured facts to `docs/VERIFIED_FACTS.md` §N and amend decision D073 in `docs/DECISIONS.md` with the numbers. Commit. The spike folder stays out of the site build; delete it after B-4 is merged.

## B-2: the body page without 3D

### B-2a: body tree data (coder)
Files: src/lib/anatomy.ts, src/lib/body-map.ts, tests/anatomy.test.ts, tests/body-map.test.ts
Goal: the data of the page of spec §5, as pure functions.
Do:
- `src/lib/body-map.ts`: `loadBodyMap(root = process.cwd())` reads `scripts/anatomy/organ-map.yaml` with `yaml` and validates it with zod (kinds, `of`, `inside`); returns `Map<organId, { kind, of: string[], inside?: string }>`.
- `src/lib/anatomy.ts`: `MODULE_SYSTEM`, the explicit map of the 18 modules `o16`…`o33` to their system term (in order: vessels, heart, respiratory, gastrointestinal, liver-biliary, pancreas, kidney, urinary-male-genital, female-genital, breast, hematolymphoid, endocrine, skin, head-neck, bone-soft-tissue, muscle-nerve, cns, eye); and `bodyTree({ entities, anatomy, systems, processes, modules, lang })` → `{ systems: [{ id, label, count, organs: [{ id, label, count, groups: [{ process, label, cards: [{ id, name }] }] }], planned: [{ id, name }] }], unplaced }`. Systems and organs in their `order`; cards in the order given; a card with several `process` terms goes into the group of its first; `count` is the number of distinct published cards; `planned` are the module's planned entries that are not published; `unplaced` counts published cards that map to no organ. `general` and `systemic` are not systems of the tree.
Acceptance: `npx vitest run tests/anatomy.test.ts tests/body-map.test.ts` passes: handwritten fixtures for the tree; on the real files, every organ of `anatomy.yaml` has a map entry, and every key and value of `MODULE_SYSTEM` exists in `modules.yaml` and `taxonomy/system.yaml`.

### B-2b: page and tree markup (coder)
Depends: B-2a
Files: src/i18n/body.ts, src/components/body/BodyTree.astro, src/pages/[lang]/body/index.astro
Goal: `/[lang]/body/` renders the tree part of the markup contract of spec §5 (no stage, no canvas yet), in both languages.
Do: follow `src/pages/[lang]/map/index.astro` for layout, breadcrumb and `getStaticPaths`; strings with `defineStrings` as in `src/i18n/horizontal.ts` (title "Il corpo" / "The body", intro, chips label, planned heading, the four kind notes of spec §3, the closing section that links to the `general` and `systemic` lenses, counts with singular and plural). Wrap the whole in `<ap-body>` (no script yet: it is an unknown element until B-4). Card links with `langPath`. Empty organ: the note "No card yet" and the planned list of its system stays. Italian typography: real apostrophes and accents.
Acceptance: `npx astro check` reports 0 errors. The lead builds and opens `/it/body/` and `/en/body/`.

### B-2c: styles, entry link, tests (coder)
Depends: B-2b
Files: src/styles/body.css, src/pages/[lang]/atlas/index.astro, src/i18n/pages.ts, tests/e2e/body.spec.ts, tests/e2e/pages.ts
Goal: the page looks like part of the atlas and is tested.
Do: `body.css` with the existing tokens only (no new colour): chips as a wrapping row with counts, sticky under the top bar on wide screens; organ sections as ruled blocks; planned entries in `--ink-muted` with the existing `.badge-planned`; `:target` highlights the organ reached by a hash; touch targets ≥ 44 px; print shows every section. One entry in the tools block of the Atlas page. `body.spec.ts`: both languages render; a chip jumps to its system; the count of a system equals its number of card links; a planned entry has the badge and no link; `#organ-<id>` scrolls that organ into view; axe has no violation. Add the page to the list in `tests/e2e/pages.ts` so the shared accessibility, layout-shift and keyboard suites visit it.
Acceptance: `npx astro check` 0 errors. The lead runs `npm run test:e2e:linux`.

### B-2d: review and merge 1 (lead)
Read `~/.claude/skills/impeccable/reference/craft-floor.md`, look at the page at phone, tablet and desktop width in both themes, fix what it shows in one batch. Gates, merge, push, CI, live smoke. Add `/it/body/` and `/en/body/` to the live smoke list.

## B-3: asset pipeline

### B-3a: build the BodyParts3D meshes (coder)
Depends: B-0e
Files: scripts/anatomy/build-body.mjs, tests/anatomy-build.test.ts
Goal: `node scripts/anatomy/build-body.mjs --raw <dir> --tables <dir> --out public/anatomy` writes `shell.glb`, one `<system>.glb` per system and `manifest.json` (spec §4) for the organs of kind `mesh`.
Do: reuse `lib.mjs` (`readTables`, `resolveElements`, `readOrganMap`, `parseObj`, `mergeMeshes`, `bbox`, `computeNormals`) and `frameOf` and `toFrame` from `spike.mjs` (the shell's three numbers, the same for every organ; a rotation, never a mirror). Per organ: merge its element files, convert to the frame, weld, simplify to its target, `computeNormals` on the result, quantize; then one glTF document per system with one mesh and one node per organ, named by the organ id, and `EXT_meshopt_compression` on the whole document (as `buildGlbs` of `spike.mjs` does for one mesh; set gltf-transform's logger to silent, its messages would break the JSON this script prints). An organ's system is its `system` in `src/content/anatomy.yaml`. The organ `skin` has no mesh of its own: it is the shell. The triangle targets come from one table at the top of the file: the list under the table of spec §11 (an organ that is not listed keeps its source count). `manifest.json`: `{ version, credit, shell: { file, bytes, triangles }, systems: { <id>: { file, bytes, triangles, organs: [..] } }, organs: { <id>: { system, kind, of, inside, box, centre } } }` for all 56 organs (`box` is `{ min, max }` and `centre` a point, in metres in the frame of spec §4; kinds other than mesh carry no box yet; `version` is the number 1; `credit` is the BodyParts3D credit of spec §2). Fail with a clear message when a file passes its budget. `--only <system>` builds one system.
Acceptance: `npx vitest run tests/anatomy-build.test.ts` builds two fixture organs into one system file and checks names, the manifest and the budget failure.

### B-3b: HRA objects and the landmark fit (coder)
Depends: B-3a
Files: scripts/anatomy/hra.mjs, scripts/anatomy/build-body.mjs, tests/anatomy-hra.test.ts
Goal: organs of kind `hra` enter their system file, placed by the `fit` of the organ map.
Do: `fitTransform(fromBox, toBox, anchor = 'centre')` → `{ scale, translate }`: one scale, the ratio of the box diagonals; translation: with `centre` the box centres coincide, with `front` the centres coincide on X and Y and the maximum-Z faces coincide (the front of the pelvis is a firmer landmark than its centre, which the sacrum pulls backwards; B-0 measured it: the centre anchor puts the uterus 2 mm in front of the bladder centre, `front` puts it 8 mm behind it, as spec §9 asks). An entry of `fits` in the organ map may carry `anchor`. `loadHra(path, nodes?)` reads a `.glb` with `@gltf-transform/core`, applies the node transforms (`getWorldMatrix`), and returns one merged mesh in metres (all nodes, or those named). The files are `<hra dir>/<object with / replaced by _>.glb`, for example `uterus-female_v1.2.glb`; the build takes `--hra <dir>`. The two boxes of a fit are the union box of all nodes of its `hra` objects and the union box of the element files of its `bp3d` concepts, converted with `toFrame` and the same shell frame as the organs. An `hra` organ is one mesh: its named `nodes` (all nodes when none are named) of all its `objects` merged, fitted, then `reduceMesh` to its target, written into the file of its system like any organ, with box and centre in the manifest and two more fields, `fit` (its name) and `objects`. Add to `TARGETS`: uterus 3000, uterine-cervix 1500, fallopian-tube 3000, breast 6000 (the ovary keeps its source count).
Acceptance: `npx vitest run tests/anatomy-hra.test.ts`: the fit maps a fixture box onto its target with the centre anchor; `front` puts the maximum-Z faces together and keeps the centres on X and Y; a fixture `.glb` with a translated node is read in world coordinates; `nodes` selects the named nodes only.

### B-3c: schematic thyroid, proxies, placement tests (coder)
Depends: B-3b
Files: scripts/anatomy/schematic.mjs, scripts/anatomy/build-body.mjs, tests/anatomy-placement.test.ts
Goal: the last kinds, and numeric proof that the placed organs sit where they should.
Do: `twoLobesIsthmus(anchors)` builds two ellipsoid lobes joined by an isthmus, in front of the trachea and just below the thyroid cartilage, sized from the trachea's width (about 320 triangles); the manifest marks it `schematic`. Proxies and `none` get `of` and no box. `anatomy-placement.test.ts` reads the real `public/anatomy/manifest.json` (skipped when absent) and checks the placement rows of spec §9 with the organ centres and boxes, in the frame of spec §4.
Acceptance: `npx vitest run tests/anatomy-placement.test.ts` passes on fixtures; on the real build after B-3d.

### B-3d: build, look, record (lead)
Run the build on the real data. Look at every system in the spike viewer in both themes: a wrong, broken or unrecognisable organ is fixed in the organ map or the targets, or downgraded to `proxy` or `none` with a line in `docs/REVIEW_QUEUE.md`. Check the budgets. Commit `public/anatomy/` (sizes in the commit message). Write `docs/licenses/anatomy.md` and the credit strings. Fill `meshes` in `src/content/anatomy.yaml` for organs with geometry. Update `scripts/sw-manifest.mjs` only in B-4d.

## B-4: viewer core

### B-4a: view state, pure (coder)
Depends: B-3a
Files: src/lib/body-view.ts, tests/body-view.test.ts
Goal: every decision of the viewer that needs no WebGL.
Do: `parseHash(hash, manifest)` → `{ system, organ }` (an organ implies its system; unknown ids give nulls) and `toHash(state)`; `roles(manifest, state, published)` → `Map<organId, 'selected' | 'system' | 'ghost' | 'idle'>` plus `empty: Set<organId>` (no published card): a proxy selects its `of`, `inside` ghosts the container, the shell is selectable only for `skin`; `selectable(manifest, state)` in anatomy order; `step(list, current, ±1)` wraps; `cameraFor(box, aspect, view)` → `{ position, target }` for front, back, side and for an organ (fits the box with a margin).
Acceptance: `npx vitest run tests/body-view.test.ts` covers each rule with a small manifest fixture.

### B-4b: three.js scene (coder)
Depends: B-4a, B-3d
Files: src/scripts/body-3d.ts
Goal: `mount()` and the `Controller` of spec §6, with the look of spec §7.
Do: named imports from `three`, `GLTFLoader` and the meshopt decoder from `three/addons`. Shell material: a small `ShaderMaterial` (Fresnel, transparent, no depth write, drawn last). Organs: `MeshLambertMaterial`, one per role, colours from `opts.colors`; `setColors()` for a theme change. Outline of the selected organ: a back-face copy scaled along the normals. Use `roles`, `selectable` and `cameraFor` from `body-view.ts`; no selection logic here. Render on demand; `ResizeObserver`; pixel ratio ≤ 2; `webglcontextlost` rejects to the caller; `dispose()` frees geometries, materials and the renderer. Load `shell.glb` first, a system file on first `showSystem`, all systems lazily for the whole-body view (after the shell is shown). In the whole-body view `skeletal-muscle` and `bones` are ghosts like the organs of other systems, because solid they hide everything else (spec §7).
Acceptance: `npx astro check` 0 errors. The lead tries it through the page after B-4c.

### B-4c1: the stage markup and styles (coder)
Depends: B-4b. The lead has put `public/anatomy/poster-light.{avif,webp}` and `poster-dark.{avif,webp}` in place (960 × 1200, transparent, the whole-body front view); B-4d's script regenerates them later.
Files: src/components/body/BodyViewer.astro, src/pages/[lang]/body/index.astro, src/styles/body.css, src/i18n/body.ts
Goal: the stage of spec §5 as static HTML, phone first, with no script; the element script is B-4c2.
Do:
- `BodyViewer.astro` (props `lang`, `credit` = the `credit` string of `public/anatomy/manifest.json`, read at build time like `src/lib/body-map.ts` does) renders, in this order: `<figure class="body-stage" data-stage tabindex="0" aria-label aria-describedby="body-help">` holding two `<picture data-poster>` (classes `poster-light` and `poster-dark`; AVIF and WebP sources; `<img width="960" height="1200" alt="">`, the figure carries the name), `<canvas data-canvas hidden>` and `<p class="body-label" data-label hidden>`; `<p id="body-help">` (what the keys do); `<div class="body-controls" role="group" aria-label>` with `<button type="button" data-load>` ("Explore in 3D") and the action buttons `data-act` = left, right, up, down, in, out, front, back, side, reset, prev, next, plus `data-off` ("Turn 3D off"), all `hidden` except `data-load` (the script shows them); `<p data-status role="status">`; `<p class="body-credit">` with the credit lines and a link to `about/licenses/`. Build the file URLs with the helper the other components use (see how `StructureViewer.astro` builds its poster URL).
- Messages the script will need go on `<ap-body>` as `data-t-*` attributes, the way `structure-viewer.ts` reads `dataset.tNone`: `tLoading`, `tReady`, `tOff`, `tError`, `tLost`, `tNoModel`, `tWhole`, `tOrgan` ("{organ}: {n}", {n} is the text of the organ's `.count` span, already pluralized), `tSystem`.
- `index.astro`: `<ap-body data-manifest={url of anatomy/manifest.json} data-t-…>`, `<BodyViewer>` first, then the tree. Do not change `BodyTree.astro`.
- `body.ts` (i18n): every new string in both languages (button names such as "Rotate left", the key help, the messages above, the credit lines: "BodyParts3D, © The Database Center for Life Science licensed under CC Attribution 4.0 International", "Female organs: HRA 3D Reference Object Library v2.5, CC BY 4.0, fitted into the base body and simplified by this project.", "Changes: merged, simplified, recoloured, moved and scaled.").
- `body.css`, phone first (spec §7): `.body-stage` full width, `aspect-ratio: 4 / 5`, `max-height: 70svh`, `position: relative`, `touch-action: pan-y`; poster and canvas stacked in one grid cell, the poster above; the dark poster replaces the light one under `@media (prefers-color-scheme: dark)` unless `:root[data-theme='light']`, and under `:root[data-theme='dark']` (as `tokens.css` does); controls one row, buttons 2.75rem high, `overflow-x: auto`, the existing button classes, focus ring `--focus`; `.body-label` absolute, `--font-display`; the credit small and muted. No layout shift when the script starts: the stage reserves its box with `aspect-ratio`, the control row has `min-height: 2.75rem`, the status line `min-height: 1.5em`. Wide screens (≥ 48rem): stage on the left (at most 30rem, sticky below the top bar), the tree on the right, chips above both. No horizontal scroll at 320 px. The viewer is not printed.
Acceptance: `npx astro check` 0 errors; `npx vitest run tests/body-map.test.ts tests/anatomy.test.ts`. The lead looks at the page at 375 and 1280 px in both themes and runs `tests/e2e/body.spec.ts`.

### B-4c2: the element (coder)
Depends: B-4c1
Files: src/scripts/body-viewer.ts, src/pages/[lang]/body/index.astro, src/styles/body.css
Goal: `<ap-body>` per spec §5 and §6: load rule, buttons, keys, hash, status line, fallback.
Do: follow `src/scripts/structure-viewer.ts` (load button, `role=status` messages read from `data-t-*`, key handling, error path) and include the script in the page the way the structure viewer's page does. Read `Options` and `Controller` in `src/scripts/body-3d.ts` and the helpers of `src/lib/body-view.ts`. Decisions already made:
- The element reads the tree from the DOM, no second data source: a manifest-like `{ organs: { [id]: { system, kind, of: [], inside: null } } }` built from `section[data-system] > section[data-organ]` is enough for `parseHash`, `toHash` and `step`. `published` for the scene: the ids of the organ sections that hold a `.body-cards li`; `labelAt` places `[data-label]` (text = the organ's name from its `h3`); `onLost` shows the poster, the `tLost` message, and the load button as "try again".
- Selection goes through `location.hash` only; `hashchange` and the first load read it with `parseHash`, reflect it in `data-system` and `data-organ` on `<ap-body>`, call `showSystem(system)` when the system changed, then `select(organ)`, and say `tOrgan` (organ name from its `h3`, {n} = the text of its `.count` span) or `tNoModel` in the status line. With the viewer running only the selected system's section is shown (set `hidden` on the others; with no system selected only chips, stage and the closing section show); with the viewer off or not started every section stays visible, as before.
- Start rule of spec §1: from 48rem (`matchMedia('(min-width: 48rem)')`) start when idle (`requestIdleCallback`, fallback `setTimeout`); below it only on a click on the poster or on `data-load`. Never when `navigator.connection?.saveData` is true or `localStorage['ap-body-3d']` is `'off'` (every `localStorage` call inside `try`). `data-off` disposes the controller, shows the poster again, stores `'off'`, and `data-load` starts again and clears it.
- Start: set `data-loading` on the stage, unhide the canvas BEFORE `mount()` so it has a size while the poster still covers it, `await import('./body-3d.ts')`, then `mount(canvas, { manifestUrl, reducedMotion, colors, published, labelAt, onLost })`; on success hide the posters, set `data-webgl="on"`, show the action buttons and hide `data-load`; on any failure hide the canvas, keep poster, tree and chips, set `data-webgl="off"`, say `tError`. `mount()` resolves after the first frame.
- Colours: the tokens hold `light-dark(...)` text, which three.js cannot parse. Resolve `--eosin`, `--hema`, `--ink`, `--surface-2` through a probe element: set `probe.style.color = 'var(--eosin)'` and read `getComputedStyle(probe).color` (an `rgb(...)` string); pass them as `{ eosin, hema, ink, surface2 }`. Read them again and call `setColors` when `data-theme` changes on `<html>` (MutationObserver) or the system scheme changes (`matchMedia('(prefers-color-scheme: dark)')`).
- Keys on the stage, per spec §6: arrows rotate, `+` `=` `-` `0` zoom and reset, `[` and `]` step through `controller.organs()` with `step` and set the hash, `Escape` clears the organ (the hash falls back to the system). `data-act` buttons call `controller.act`; `prev` and `next` do what `[` and `]` do. Reduced motion comes from `matchMedia('(prefers-reduced-motion: reduce)')`.
Acceptance: `npx astro check` 0 errors. The lead runs the page in the browser (with software WebGL) and checks start, a system, an organ, Back, 3D off.

### B-4d: offline and budgets (coder)
Depends: B-4c2
Files: scripts/sw-manifest.mjs, public/sw.js, tests/sw-manifest.test.ts, tests/dist/body.test.ts, scripts/anatomy/poster.mjs
Goal: the viewer chunk and the meshes are cached on first use, never in the shell; the budgets are tests; the posters can be regenerated.
Do:
- `scripts/sw-manifest.mjs`: `LAZY_ONLY` also matches the `body-3d` chunk (`_astro/body-3d.<hash>.js`, 653 kB minified, about 175 kB gzip; today only `structure-3d` is named, so the worker precaches the body chunk for every visitor); `isLazyCached` also takes the files under `anatomy/` (their hashes feed the worker version, as `structures/` do). No offline pack for the body in this task: the body page belongs to no module, and B-9 decides the rest.
- `public/sw.js`: files under `${BASE}anatomy/` take the `hashedAsset` branch next to `_astro/` and `structures/` (cache first, stored on first use); update the header comment.
- `tests/sw-manifest.test.ts`: new rows next to the 3Dmol ones: `isShellAsset('_astro/body-3d.XXXXXXXX.js')` is false, `isLazyCached` is true for it and for `anatomy/heart.glb`, the worker version changes when an anatomy file changes. Do not edit the existing rows.
- `tests/dist/body.test.ts` (reads `dist/` after `npm run build`; see `tests/dist/lib.ts` and `pathway.test.ts` for the helpers): `shell.glb` ≤ 400,000 bytes; each `<system>.glb` ≤ 500,000; `manifest.json` ≤ 12,000; all files under `dist/anatomy` together ≤ 6,000,000; each `poster-*` file ≤ 60,000; the manifest's `triangles` of the shell and all systems add up to ≤ 250,000; `CREDITS.txt` exists; there is exactly one `body-3d` chunk and its gzip size (`zlib.gzipSync`) is ≤ 192,000 (spec §11, ceiling 200,000); no HTML page references it and it is not in `precache.json`; the static scripts of `dist/it/body/index.html` (the `<script src>` and modulepreload URLs) weigh at most 20,000 bytes gzip together. Each limit in one table at the top of the file with a comment naming the spec section.
- `scripts/anatomy/poster.mjs` (Node, run by hand, exported pure helpers where useful): with Playwright Chromium and software WebGL (launch args `--use-angle=swiftshader`, `--enable-unsafe-swiftshader`, `--ignore-gpu-blocklist`, `--enable-webgl`) open the built page from `dist/` served by `createDistServer` of `scripts/serve-dist.mjs`, at 480 × 600 CSS px and device scale 2, once with `colorScheme: 'light'` and once `'dark'`; click `[data-load]`, wait for `ap-body[data-webgl="on"]` and 1.5 s more; inject CSS that makes `html, body, .body-stage` transparent with no border and hides `[data-label]`; screenshot `[data-stage]` with `omitBackground: true`; write `public/anatomy/poster-<theme>.avif` (quality 55) and `.webp` (quality 72, alphaQuality 70, smartSubsample) with `sharp`; print the four sizes. It shows the whole-body view (no hash).
Acceptance: `npx vitest run tests/sw-manifest.test.ts`. The lead runs `npm run build && npm run test:dist` and the poster script.

### B-4e: viewer tests (coder)
Depends: B-4c2
Files: tests/e2e/body-viewer.spec.ts
Goal: the e2e rows of spec §9 for the viewer. Leave `tests/e2e/body.spec.ts` as it is.
Do: read `tests/e2e/body.spec.ts` (axe, the project and language loops), `tests/e2e/cls.spec.ts` (how layout shift is measured) and `src/scripts/body-viewer.ts` (what the element does) first. A helper `startViewer(page)` opens `/<lang>/body/`, starts the viewer (from 48rem it starts by itself when idle; below it click `[data-load]` through `dispatchEvent('click')`, because the fixed bottom bar can cover the button) and returns whether `ap-body[data-webgl="on"]` is reached within 30 s; every test that needs the canvas skips when it is not (`test.skip(!on, ...)`: Firefox and WebKit runners may have no WebGL). Tests, Italian and English:
- a chip click sets `data-system` and shows only that system's section; an organ link sets `data-organ` and the label (`[data-label]`) shows the organ's name; `]` moves to the next organ and the page does not scroll below 48rem; `Escape` clears the organ and keeps the system; Back restores the previous selection (hash and `data-organ`).
- the load rule: below 48rem it does not start by itself (`data-webgl` is not `on` after 3 s) and a tap on `[data-load]` starts it; `[data-off]` turns it off, shows the poster again and a reload does not start it; `data-load` starts it again.
- no WebGL: an init script makes `HTMLCanvasElement.prototype.getContext` return null; the posters, the tree and the status message stay, `data-webgl` is `off`, no page error.
- context lost (canvas tests): call `getContext('webgl2').getExtension('WEBGL_lose_context').loseContext()` on `[data-canvas]` after start; `data-webgl` becomes `off`, the poster is back and the status line is not empty.
- reduced motion (`page.emulateMedia({ reducedMotion: 'reduce' })`): after a chip click the status line reports the system at once and nothing throws.
- layout shift is 0 from load until `data-webgl` is `on` (measure as `cls.spec.ts` does).
- axe has no violation with the viewer on and one organ selected, and with it off.
Acceptance: `npx tsc --noEmit -p .` style check is the lead's (`npx astro check`); the lead runs `E2E_ENGINES=chromium npx playwright test tests/e2e/body-viewer.spec.ts --workers=2` on the host (Docker is down) and CI runs all engines.

### B-4f: review (lead)
Three fresh read-only lean agents read `src/scripts/body-3d.ts`, `body-viewer.ts`, `src/lib/body-view.ts` and spec §5–§7, one lens each: three.js lifecycle and memory (dispose, context loss, listeners); accessibility (names, focus, keys, status messages, reduced motion); performance (frames on demand, pixel ratio, loading order, chunk contents). Each returns at most 10 findings as `file:line, problem, fix`. The lead fixes the confirmed ones.

## B-5: picking, label, panel

### B-5a: pointer picking and gestures (coder)
Depends: B-4c2
Files: src/scripts/body-viewer.ts, src/scripts/body-3d.ts, tests/e2e/body-viewer.spec.ts
Goal: a tap or click on the canvas chooses an organ; the gestures of spec §6 are complete.
Do: `body-3d.ts` already has drag to rotate, pinch and ctrl + wheel to zoom (a plain wheel scrolls the page, do not change that) and `pick(x, y)` (canvas CSS pixels; solid organs first, ghosts only when none is hit). Add to it a tap: one pointer, released within 6 px of where it went down and within 400 ms, with no second pointer at any time during it (a pinch is never a tap). A tap calls a new option `onPick(organ: string | null)` with `pick(...)` of the release point. Add a `cursor` on the canvas for a mouse (`pointerType === 'mouse'`, no button): `pointer` over an organ, `grab` elsewhere, `grabbing` while dragging; at most one `pick` per animation frame while the mouse moves; touch and pen never hover. In `body-viewer.ts` pass `onPick`: an organ sets the hash like a link does (`setHash({ system: its system, organ })`), `null` (a tap on nothing) clears the organ and keeps the system (`setHash({ system: current, organ: null })`). After a selection made on the canvas move keyboard focus to that organ's heading link (`#organ-<id> > h3 a`, `focus({ preventScroll: true })` below 48rem and plain `focus()` from 48rem, where the panel sits beside the stage); not after a selection made by a key or a link. Tests (canvas runs only, `test.skip` when WebGL is off): a click on the stage centre in the whole-body view sets some `data-organ`; a click far from the body (the stage corner) clears the organ and keeps `data-system`; a drag of more than 6 px does not change the hash; the organ heading link has focus after a canvas selection; two touch points do not make a tap (use `page.touchscreen` or dispatched pointer events with two pointer ids).
Acceptance: `npx astro check` 0 errors. The lead runs `E2E_ENGINES=chromium npx playwright test tests/e2e/body-viewer.spec.ts --workers=2` on the host.

### B-5b: label and organ panel (coder)
Depends: B-5a
Files: src/scripts/body-viewer.ts, src/scripts/body-3d.ts, src/styles/body.css, src/components/body/BodyViewer.astro, tests/e2e/body-viewer.spec.ts
Do: the label of spec §7 at the projected organ centre with a leader line (an SVG line; hidden when the organ is off screen); previous and next organ buttons; after a selection from the canvas, focus moves to the organ's heading in the panel and the status line says "<organ>: <n> cards"; the panel scrolls inside its column on wide screens.
Acceptance: `npx astro check` 0 errors; e2e: selecting an organ shows its name in the label and focuses its heading.

### B-5c: checkpoint (lead)
Design pass as in B-2d and the gates on the branch. Merge 2 happens after B-9.

## B-9: the body on the home page, phone first

### B-9a: phone layout of the viewer (coder)
Depends: B-5b
Files: src/styles/body.css, src/components/body/BodyViewer.astro, src/scripts/body-viewer.ts, src/i18n/body.ts
Goal: the phone layout of spec §7: stage box, chip row, control row, the organ panel as a bottom sheet.
Do: below 48rem the organ section of the selected organ is shown as a sheet over the page bottom: a close button, focus moved in on open and back to the stage on close, `Escape` closes, the page behind does not scroll while it is open (`overscroll-behavior: contain` on the sheet, no body scroll lock by script). Chips: one row at every width, not only on phones (seen in B-4c1: at 1280 × 800 the 18 wrapped chips take five rows and push the stage below the fold), `overflow-x: auto`, scroll snap, the selected chip scrolled into view; on wide screens the row sits above the stage and the stage must start in the first screen once the notice is dismissed. Start rule of spec §1 for phones: the poster carries one button, "Explore in 3D". Check at 320, 375 and 430 px: no horizontal page scroll.
Acceptance: `npx astro check` 0 errors. The lead looks at 375 × 812 in both themes.

### B-9b: the body on the home page (coder)
Depends: B-9a
Files: src/pages/[lang]/index.astro, src/components/body/BodyHome.astro, src/components/body/BodyViewer.astro, src/i18n/pages.ts, src/styles/body.css
Goal: the home page is a short description of the atlas, then the body.
Do: `BodyHome.astro` renders the same `<ap-body>` stage, chips and controls, and for each system only its organ list with counts (each organ links to `/[lang]/body/#organ-<id>`, where the cards are), plus one link to the full body page. Place it right after the intro of the home page, before the progress section; shorten the intro to two or three sentences that say what the atlas is and that it is free, without login. Do not touch the progress section (another task owns it). The viewer script is the same module; the home page must not ship more JavaScript than before until the viewer starts.
Acceptance: `npx astro check` 0 errors; `npm run build && npm run test:dist` (page weight budgets) by the lead.

### B-9c: phone tests (coder)
Depends: B-9b
Files: tests/e2e/body-phone.spec.ts, tests/e2e/pages.ts
Goal: the phone rows of spec §9, at 375 × 812 with touch enabled.
Do: home page: the description, then the stage, both inside the first two screens; tap on "Explore in 3D" sets `data-webgl` (canvas checks skip when it is `off`); tap a chip, the organ list of that system shows; tap an organ, the full body page opens on that organ with its sheet; close the sheet; no horizontal scroll (`scrollWidth` equals `clientWidth` on the root); layout shift 0 while the viewer starts; axe with the sheet open.
Acceptance: the lead runs `npm run test:e2e:linux`.

### B-9d: review on a phone and merge 2 (lead)
Design pass as in B-2d at 375 × 812 and 320 × 568, both themes; try it in the iOS Simulator (Safari) when one is available; Lighthouse phone profile ≥ 90 on the home page; gates, merge, push, CI, live smoke with the viewer started.

## B-6: where in the body, on cards

### B-6a: the block on a card (coder)
Depends: B-2a
Files: src/components/entity/WhereInBody.astro, src/pages/[lang]/e/[id].astro, src/i18n/body.ts, tests/e2e/body.spec.ts
Do: under the card's lens chips, "Where in the body": the organs of `organsOfCard` as links to the body page hash, each with its system; nothing when the card maps to no organ. Check the real path of the card page before editing (it may differ from the one named here; if so, edit that file and say so in the report).
Acceptance: `npx astro check` 0 errors; e2e: an organ link on a card lands on the body page with that organ as target.

## B-7: progress on the body

### B-7a: seen, mastered, due per organ (coder)
Depends: B-4c2
Files: src/scripts/body-progress.ts, src/components/body/BodyTree.astro, src/styles/body.css, src/i18n/body.ts, tests/body-progress.test.ts
Do: read the learner database the study pages already use (find its module under `src/lib`; no new store, no schema change). A pure function turns its records and the tree's card ids into `{ seen, mastered, due }` per organ and system; the script writes three small counters next to each organ and a "Review this organ" link that opens the existing study session filtered to those cards (use the filter the study page already accepts; if it has none, return `blocked` with what is missing).
Acceptance: `npx vitest run tests/body-progress.test.ts` on the pure function.

### B-7b: merge 3 (lead)
Gates including the study e2e suite, merge, push, CI, live smoke.

## B-8: polish (lead)

Design polish with the impeccable skill (`polish`, then `audit`) on the page with the viewer on; an accessibility review and a performance pass by two fresh read-only agents; Lighthouse ≥ 90 on `/it/body/`; delete the spike folder; ask the owner to try it on an iPad and record what they report. Merge 4.
