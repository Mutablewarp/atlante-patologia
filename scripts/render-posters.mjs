#!/usr/bin/env node
// Poster images for the 3D viewer (<ap-structure>), made offline with
// Playwright + 3Dmol from the committed structure files. Run by hand after
// fetch-structures.mjs; outputs are committed (no runtime cost, no network).
//
//   node scripts/render-posters.mjs [id…]   → src/assets/structures/<id>.png (640×480, on the light stage colour)
//
// The drawing matches scripts/structure-3d.ts: grey cartoon, the highlight of
// the first pathway step that uses the structure in orange with spheres, on the
// opaque light stage colour that keeps both colours readable in the dark theme too.
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { parse } from 'yaml';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const ORIGIN = 'http://posters.invalid';
const OUT = `${ROOT}src/assets/structures/`;

/** structure id → { coarse, show, highlight } from the first step that uses it. */
function jobs() {
  const out = new Map();
  for (const f of readdirSync(`${ROOT}src/content/pathways`).filter((x) => x.endsWith('.yaml'))) {
    for (const step of parse(readFileSync(`${ROOT}src/content/pathways/${f}`, 'utf8')).steps) {
      if (!step.structure || out.has(step.structure)) continue;
      const s = parse(readFileSync(`${ROOT}src/content/structures/${step.structure}.yaml`, 'utf8'));
      out.set(step.structure, { coarse: s.coarse, show: s.show, highlight: step.highlight ?? null, file: s.file });
    }
  }
  return out;
}

const PAGE = `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;background:transparent}#v{position:relative;width:640px;height:480px}</style>
<div id="v"></div>
<script type="module">
  import { createViewer } from '${ORIGIN}/3Dmol.js';
  window.draw = async (job) => {
    const bytes = new Uint8Array(await (await fetch('${ORIGIN}/' + job.file)).arrayBuffer());
    const v = createViewer(document.getElementById('v'), { backgroundColor: '#f6f1e7', backgroundAlpha: 1, antialias: true });
    v.addModel(bytes, 'bcif');
    const scope = job.show ? { chain: job.show } : {};
    const cartoon = (color) => ({ cartoon: job.coarse ? { style: 'trace', color, thickness: 0.6 } : { color } });
    v.setStyle({}, {});
    v.setStyle(scope, cartoon('#9a9a9a'));
    const h = job.highlight;
    if (h) {
      const sel = { ...scope, ...(h.chains ? { chain: h.chains } : {}), ...(h.resi ? { resi: h.resi } : {}), ...(h.resn ? { resn: h.resn } : {}) };
      v.setStyle(sel, h.resn ? { stick: { color: '#e66100', radius: 0.3 } } : cartoon('#e66100'));
      v.addStyle(h.resn ? sel : { ...sel, atom: 'CA' }, { sphere: { color: '#e66100', radius: h.resn ? 0.45 : job.coarse ? 1.6 : 0.9 } });
    }
    v.zoomTo(scope);
    v.render();
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  };
</script>`;

const only = process.argv.slice(2); // optional structure ids
const browser = await chromium.launch();
mkdirSync(OUT, { recursive: true });
for (const [id, job] of jobs()) {
  if (only.length && !only.includes(id)) continue;
  // A fresh page per structure: reused WebGL contexts stalled the 14-chain trace.
  const page = await browser.newPage({ viewport: { width: 640, height: 480 } });
  await page.route(`${ORIGIN}/**`, (route) => {
    const path = new URL(route.request().url()).pathname.slice(1);
    if (path === 'index.html') return route.fulfill({ contentType: 'text/html', body: PAGE });
    if (path === '3Dmol.js')
      return route.fulfill({ contentType: 'text/javascript', body: readFileSync(`${ROOT}node_modules/3dmol/build/3Dmol.es6-min.js`) });
    return route.fulfill({ contentType: 'application/octet-stream', body: gunzipSync(readFileSync(`${ROOT}public/${path}`)) });
  });
  await page.goto(`${ORIGIN}/index.html`);
  await page.evaluate((j) => window.draw(j), job);
  writeFileSync(`${OUT}${id}.png`, await page.locator('#v').screenshot());
  await page.close();
  console.log(`poster ${id}.png`);
}
await browser.close();
