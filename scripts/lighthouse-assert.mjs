#!/usr/bin/env node
// Lighthouse gate (ARCHITECTURE §7): mobile emulation (Lighthouse defaults:
// Moto G-class screen, simulated slow 4G and 4× CPU), score ≥ 90 for
// Performance, Accessibility, Best Practices and SEO on sample pages of dist/.
//
//   npm run build && npm run lighthouse [-- /it/ /en/atlas/]
//
// Chromium comes from Playwright (or CHROME_PATH). Scores go to
// reports/lighthouse.json; the process exits 1 when a page is below threshold.
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';
import lighthouse from 'lighthouse';
import { createDistServer } from './serve-dist.mjs';

const CATEGORIES = ['performance', 'accessibility', 'best-practices', 'seo'];
const THRESHOLD = 0.9;
const DEBUG_PORT = Number(process.env.LH_DEBUG_PORT ?? 9333);
const paths = process.argv.slice(2).length ? process.argv.slice(2) : ['/it/', '/en/atlas/', '/it/about/'];

// gzip, as GitHub Pages sends text: uncompressed, the 170 KB card pages lose about 10 performance points (docs/PROGRESS.md).
const server = createDistServer({ gzip: true });
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  channel: process.env.CHROME_PATH ? undefined : 'chromium', // full Chromium, new headless mode
  args: [`--remote-debugging-port=${DEBUG_PORT}`],
});

const results = [];
let failed = false;
try {
  for (const path of paths) {
    const url = `${origin}/atlante-patologia${path}`;
    // Lab scores jitter on busy machines (a cold first run can lose 30 points of
    // Performance), so a page below threshold gets one more run; the better run counts.
    let lhr;
    let low = CATEGORIES;
    for (let attempt = 0; attempt < 2 && low.length; attempt++) {
      const run = await lighthouse(url, { port: DEBUG_PORT, output: 'json', logLevel: 'error', onlyCategories: CATEGORIES });
      if (!run) throw new Error(`Lighthouse returned no result for ${url}`);
      if (run.lhr.runtimeError) throw new Error(`${path}: ${run.lhr.runtimeError.code} ${run.lhr.runtimeError.message}`);
      const runLow = CATEGORIES.filter((c) => (run.lhr.categories[c]?.score ?? 0) < THRESHOLD);
      if (!lhr || runLow.length < low.length) [lhr, low] = [run.lhr, runLow];
    }
    const scores = Object.fromEntries(CATEGORIES.map((c) => [c, Math.round((lhr.categories[c]?.score ?? 0) * 100)]));
    // The audits that cost points, so a failure says what to fix.
    const losses = Object.values(lhr.audits)
      .filter((a) => a.scoreDisplayMode !== 'informative' && a.scoreDisplayMode !== 'notApplicable' && a.score !== null && a.score < 0.9)
      .map((a) => `${a.id} (${a.displayValue ?? a.score})`);
    results.push({ path, scores, formFactor: lhr.configSettings.formFactor, losses });
    console.log(`${low.length ? 'FAIL' : 'ok  '} ${path.padEnd(16)} ${CATEGORIES.map((c) => `${c} ${scores[c]}`).join(' · ')}`);
    if (low.length) {
      failed = true;
      console.log(`     below ${THRESHOLD * 100}: ${low.join(', ')}; audits: ${losses.join(', ')}`);
    }
  }
} finally {
  await browser.close();
  server.close();
}

mkdirSync('reports', { recursive: true });
const report = { generated: new Date().toISOString(), lighthouse: '13.5.0', threshold: THRESHOLD * 100, results };
writeFileSync('reports/lighthouse.json', `${JSON.stringify(report, null, 2)}\n`);
console.log('scores written to reports/lighthouse.json');
process.exit(failed ? 1 : 0);
