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
- Order: B-0 → B-2 (merge 1: the page) → B-3 → B-4 → B-5 (merge 2: the 3D viewer) → B-6 → B-7 (merge 3) → B-8 (merge 4). B-2 does not wait for B-0.

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
Do: `node scripts/anatomy/spike.mjs --raw <dir of OBJ files> --tables <dir> --out .work/anatomy/spike` builds heart, lung, liver, kidney, stomach and the shell from the organ map at three triangle targets each (shell 8k, 16k, 30k; organs 2k, 5k, 12k), with `@gltf-transform/functions` (weld, simplify with `MeshoptSimplifier`, quantize, then meshopt compression) and writes each as `.glb` twice: quantized only, and quantized plus `EXT_meshopt_compression`. Print one JSON array: organ, target, triangles, bytes of the source OBJ files, bytes of both outputs. Convert to the frame of spec §4 (Y up, metres, feet at 0).
Acceptance: `npx vitest run tests/anatomy-spike.test.ts` builds one fixture organ and reads the `.glb` back (mesh name is the organ id; triangle count ≤ target). The lead runs the real spike and pastes the table into spec §11.

### B-0d: spike viewer (coder)
Depends: setup step 2
Files: scripts/anatomy/spike-viewer/
Goal: see the spike meshes with the look of spec §7 and measure the three.js chunk and the frame rate.
Do: `index.html`, `main.js` and `build.mjs` (esbuild, already installed with Astro). `main.js` loads every `.glb` of `./assets/` with `GLTFLoader` and the meshopt decoder that ships with three, draws the shell with the Fresnel look and the organs in the eosin and hematoxylin colours (hard-coded copies of the token values of both themes; a `?theme=dark` switch), buttons to rotate, zoom and reset, click to select an organ, and a frame-rate readout while rotating (`?spin=1` rotates for 5 s and prints the average). Render on demand as in spec §6. `build.mjs` bundles `main.js` into `dist/`, prints the minified and gzip bytes, and copies `index.html`. Import only what is used (`three` named imports, `three/addons/loaders/GLTFLoader.js`, `three/addons/libs/meshopt_decoder.module.js`).
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
Do: reuse `lib.mjs`. One mesh per organ, named by the organ id; the triangle targets come from one table at the top of the file (the numbers of spec §11). `manifest.json`: `{ version, credit, shell: { file, bytes, triangles }, systems: { <id>: { file, bytes, triangles, organs: [..] } }, organs: { <id>: { system, kind, of, inside, box, centre } } }` for all 56 organs (kinds other than mesh carry no box yet). Fail with a clear message when a file passes its budget. `--only <system>` builds one system.
Acceptance: `npx vitest run tests/anatomy-build.test.ts` builds two fixture organs into one system file and checks names, the manifest and the budget failure.

### B-3b: HRA objects and the landmark fit (coder)
Depends: B-3a
Files: scripts/anatomy/hra.mjs, scripts/anatomy/build-body.mjs, tests/anatomy-hra.test.ts
Goal: organs of kind `hra` enter their system file, placed by the `fit` of the organ map.
Do: `fitTransform(fromBox, toBox)` → `{ scale, translate }` (one scale: the ratio of the box diagonals; translation: centre to centre); `loadHra(path, nodes?)` reads a `.glb` with `@gltf-transform/core`, applies the node transforms, and returns one merged mesh (all nodes, or those named). The build applies the fit, then simplifies and writes like any organ, and records `fit` and the HRA object ids in the manifest.
Acceptance: `npx vitest run tests/anatomy-hra.test.ts`: the fit maps a fixture box onto its target; a fixture `.glb` with a translated node is read in world coordinates.

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
Do: named imports from `three`, `GLTFLoader` and the meshopt decoder from `three/addons`. Shell material: a small `ShaderMaterial` (Fresnel, transparent, no depth write, drawn last). Organs: `MeshLambertMaterial`, one per role, colours from `opts.colors`; `setColors()` for a theme change. Outline of the selected organ: a back-face copy scaled along the normals. Use `roles`, `selectable` and `cameraFor` from `body-view.ts`; no selection logic here. Render on demand; `ResizeObserver`; pixel ratio ≤ 2; `webglcontextlost` rejects to the caller; `dispose()` frees geometries, materials and the renderer. Load `shell.glb` first, a system file on first `showSystem`, all systems lazily for the whole-body view (after the shell is shown).
Acceptance: `npx astro check` 0 errors. The lead tries it through the page after B-4c.

### B-4c: the element and its markup (coder)
Depends: B-4b
Files: src/scripts/body-viewer.ts, src/components/body/BodyViewer.astro, src/pages/[lang]/body/index.astro, src/styles/body.css, src/i18n/body.ts
Goal: `<ap-body>` per spec §5 and §6: poster, load rule, buttons, keys, hash, status line, fallback.
Do: follow `src/scripts/structure-viewer.ts` (same load button, status announcements, key handling and error path). The element reads the tree from the DOM (no second data source). Selection goes through `location.hash` only. With the viewer on, show only the selected system's section (attribute on `<ap-body>`, styled in CSS; printing shows all). Start rule of spec §1; the off choice in `localStorage` inside `try`. Reflect `data-system`, `data-organ`, `data-webgl`. Colours: read the tokens with `getComputedStyle`, again on a theme change.
Acceptance: `npx astro check` 0 errors.

### B-4d: offline and budgets (coder)
Depends: B-4c
Files: scripts/sw-manifest.mjs, tests/sw-manifest.test.ts, tests/dist/body.test.ts, scripts/anatomy/poster.mjs
Goal: the viewer chunk and the meshes are cached on first use, never in the shell; budgets are tests; the poster exists.
Do: extend `LAZY_ONLY` to the `body-3d` chunk and `isLazyCached` to `anatomy/`; the offline pack of the body page lists its files (follow the pathway pack). `tests/dist/body.test.ts`: budgets of spec §4 and §9 on `dist/`. `poster.mjs`: with Playwright Chromium, open the built page, start the viewer, wait for `data-webgl="on"`, screenshot the stage in both themes at 2× and write AVIF and WebP with `sharp` into `public/anatomy/`.
Acceptance: `npx vitest run tests/sw-manifest.test.ts` passes; the lead runs `npm run build && npm run test:dist`, and the poster script inside the Playwright container.

### B-4e: viewer tests (coder)
Depends: B-4c
Files: tests/e2e/body-viewer.spec.ts
Goal: the e2e rows of spec §9.
Do: a helper starts the viewer and returns whether `data-webgl` is `on`; canvas-only checks skip otherwise. Tests: chip → `data-system`; organ link → `data-organ` and the label text; `]` moves to the next organ; `Escape` clears; Back restores; with `getContext` stubbed to return null (init script) the poster, the tree and the message stay and nothing throws; with reduced motion no camera animation runs (the status line reports the organ at once); layout shift stays 0 when the canvas replaces the poster; axe has no violation with the viewer on.
Acceptance: the lead runs `npm run test:e2e:linux`.

### B-4f: review (lead)
Three fresh read-only lean agents read `src/scripts/body-3d.ts`, `body-viewer.ts`, `src/lib/body-view.ts` and spec §5–§7, one lens each: three.js lifecycle and memory (dispose, context loss, listeners); accessibility (names, focus, keys, status messages, reduced motion); performance (frames on demand, pixel ratio, loading order, chunk contents). Each returns at most 10 findings as `file:line, problem, fix`. The lead fixes the confirmed ones.

## B-5: picking, label, panel

### B-5a: pointer picking and gestures (coder)
Depends: B-4c
Files: src/scripts/body-viewer.ts, src/scripts/body-3d.ts, tests/e2e/body-viewer.spec.ts
Do: tap (moved < 6 px) picks and sets the hash; drag rotates; pinch and wheel-with-ctrl zoom; a plain wheel scrolls the page; hover highlights only for a fine pointer. A tap on nothing clears the organ and keeps the system.
Acceptance: `npx astro check` 0 errors; one e2e test clicks the stage centre in the whole-body view and expects some `data-organ` (canvas runs only).

### B-5b: label and organ panel (coder)
Depends: B-5a
Files: src/scripts/body-viewer.ts, src/scripts/body-3d.ts, src/styles/body.css, src/components/body/BodyViewer.astro, tests/e2e/body-viewer.spec.ts
Do: the label of spec §7 at the projected organ centre with a leader line (an SVG line; hidden when the organ is off screen); previous and next organ buttons; after a selection from the canvas, focus moves to the organ's heading in the panel and the status line says "<organ>: <n> cards"; the panel scrolls inside its column on wide screens.
Acceptance: `npx astro check` 0 errors; e2e: selecting an organ shows its name in the label and focuses its heading.

### B-5c: merge 2 (lead)
Design pass as in B-2d, gates, merge, push, CI, live smoke with the viewer started in the smoke script.

## B-6: where in the body, on cards

### B-6a: the block on a card (coder)
Depends: B-2a
Files: src/components/entity/WhereInBody.astro, src/pages/[lang]/e/[id].astro, src/i18n/body.ts, tests/e2e/body.spec.ts
Do: under the card's lens chips, "Where in the body": the organs of `organsOfCard` as links to the body page hash, each with its system; nothing when the card maps to no organ. Check the real path of the card page before editing (it may differ from the one named here; if so, edit that file and say so in the report).
Acceptance: `npx astro check` 0 errors; e2e: an organ link on a card lands on the body page with that organ as target.

## B-7: progress on the body

### B-7a: seen, mastered, due per organ (coder)
Depends: B-4c
Files: src/scripts/body-progress.ts, src/components/body/BodyTree.astro, src/styles/body.css, src/i18n/body.ts, tests/body-progress.test.ts
Do: read the learner database the study pages already use (find its module under `src/lib`; no new store, no schema change). A pure function turns its records and the tree's card ids into `{ seen, mastered, due }` per organ and system; the script writes three small counters next to each organ and a "Review this organ" link that opens the existing study session filtered to those cards (use the filter the study page already accepts; if it has none, return `blocked` with what is missing).
Acceptance: `npx vitest run tests/body-progress.test.ts` on the pure function.

### B-7b: merge 3 (lead)
Gates including the study e2e suite, merge, push, CI, live smoke.

## B-8: polish (lead)

Design polish with the impeccable skill (`polish`, then `audit`) on the page with the viewer on; an accessibility review and a performance pass by two fresh read-only agents; Lighthouse ≥ 90 on `/it/body/`; delete the spike folder; ask the owner to try it on an iPad and record what they report. Merge 4.
