#!/usr/bin/env node
// Regenerates the body posters (docs/BODY_SPEC.md §11) from the built page in dist/.
//
//   npm run build && node scripts/anatomy/poster.mjs
//
// Opens /it/body/ with software WebGL, once per color scheme, loads the viewer, screenshots the stage on a
// transparent background and writes public/anatomy/poster-<theme>.{avif,webp}.
import { mkdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import sharp from 'sharp';
import { createDistServer } from '../serve-dist.mjs';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const OUT = join(ROOT, 'public/anatomy');
const BASE = '/atlante-patologia/';
export const THEMES = ['light', 'dark'];
// Wider and taller than the stage: below 48rem the viewer waits for the click, and the stage is not cut by max-height: 70svh.
export const VIEWPORT = { width: 700, height: 1000 };
export const STAGE = { width: 480, height: 600 }; // 4:5, shot at 2x: 960 x 1200
export const LAUNCH_ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'];
export const AVIF = { quality: 55 };
export const WEBP = { quality: 72, alphaQuality: 70, smartSubsample: true };
// Transparent stage of a fixed 4:5 size, without frame or labels, so the poster shows only the body.
export const CLEAN_CSS = `html, body, .body-stage { background: transparent !important; border: 0 !important; } .body-stage { width: ${STAGE.width}px !important; height: ${STAGE.height}px !important; max-height: none !important; aspect-ratio: auto !important; } [data-label] { display: none !important; }`;

/** Output file of one poster. */
export const posterPath = (theme, ext) => join(OUT, `poster-${theme}.${ext}`);

async function shoot(browser, url, theme) {
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2, colorScheme: theme });
  try {
    const page = await context.newPage();
    await page.goto(url);
    await page.locator('[data-load]').dispatchEvent('click'); // a fixed bottom bar may cover the button on a narrow screen
    await page.waitForSelector('ap-body[data-webgl="on"]', { timeout: 60_000 });
    await page.waitForTimeout(1500);
    await page.addStyleTag({ content: CLEAN_CSS });
    await page.waitForTimeout(1000); // the canvas resizes and the camera fits the new box
    return await page.locator('[data-stage]').screenshot({ omitBackground: true });
  } finally {
    await context.close();
  }
}

async function main() {
  const server = createDistServer();
  await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
  const url = `http://127.0.0.1:${server.address().port}${BASE}it/body/`;
  const browser = await chromium.launch({ args: LAUNCH_ARGS });
  mkdirSync(OUT, { recursive: true });
  const sizes = {};
  try {
    for (const theme of THEMES) {
      const png = await shoot(browser, url, theme);
      await sharp(png).avif(AVIF).toFile(posterPath(theme, 'avif'));
      await sharp(png).webp(WEBP).toFile(posterPath(theme, 'webp'));
      for (const ext of ['avif', 'webp']) sizes[`poster-${theme}.${ext}`] = statSync(posterPath(theme, ext)).size;
    }
  } finally {
    await browser.close();
    server.close();
  }
  console.log(JSON.stringify(sizes, null, 2));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
