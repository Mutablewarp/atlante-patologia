#!/usr/bin/env node
// App icons from the original logo (a stained cell in a round microscope
// field: eosin pink cytoplasm, hematoxylin nucleus). Colours from tokens.css
// (light theme). Run by hand after changing the logo; outputs are committed.
//
//   node scripts/icons.mjs   → public/icons/{icon-192,icon-512,icon-maskable-512,apple-touch-icon}.png + icon.svg
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const OUT = fileURLToPath(new URL('../public/icons/', import.meta.url));
const C = { paper: '#f6f1e7', surface: '#fffcf6', eosin: '#ad2c5b', eosinSoft: '#f8e2ea', hema: '#3a2e8c', hemaSoft: '#e5e0f6' };

/** The 32×32 logo (same drawing as BrandMark.astro), placed at `scale` of a square canvas. */
function svg(scale, { background = true } = {}) {
  const s = (512 * scale) / 32;
  const o = (512 - 32 * s) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  ${background ? `<rect width="512" height="512" fill="${C.paper}"/>` : ''}
  <g transform="translate(${o} ${o}) scale(${s})">
    <circle cx="16" cy="16" r="14.5" fill="${C.eosinSoft}" stroke="${C.eosin}" stroke-width="1.5"/>
    <path d="M7.5 17.5c1-5.6 6.4-9.3 11.6-7.9 4.3 1.2 6.4 5.6 4.6 9.6-1.9 4.3-7.4 6.3-11.7 4.6-3.1-1.2-5-3.6-4.5-6.3z" fill="${C.surface}" stroke="${C.eosin}" stroke-width="1.2"/>
    <circle cx="16.4" cy="16.6" r="3.6" fill="${C.hema}"/>
    <circle cx="17.5" cy="15.5" r="1" fill="${C.hemaSoft}"/>
  </g>
</svg>`;
}

// "any" icons: the field fills most of the square. Maskable: the whole logo
// sits inside the 80% safe zone (r = 40% of the side), so any mask shape keeps it.
const any = svg(0.88);
const maskable = svg(0.7);

mkdirSync(OUT, { recursive: true });
writeFileSync(`${OUT}icon.svg`, `${any}\n`);
const jobs = [
  [any, 192, 'icon-192.png'],
  [any, 512, 'icon-512.png'],
  [maskable, 512, 'icon-maskable-512.png'],
  [maskable, 180, 'apple-touch-icon.png'],
];
for (const [src, size, name] of jobs) {
  await sharp(Buffer.from(src)).resize(size, size).png({ compressionLevel: 9 }).toFile(`${OUT}${name}`);
  console.log(`icons: ${name} (${size}×${size})`);
}
