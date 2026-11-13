#!/usr/bin/env node
// Spike behind docs/IMAGE_ENCODING.md: bytes, PSNR and SSIM of WebP and AVIF at candidate widths, on 10 images
// from src/assets/images. Reference = the source resized with sharp's defaults (what Astro does); PSNR and SSIM
// are computed on the decoded sRGB buffers (SSIM: luma, 8x8 windows, stride 4).
//   node scripts/image-spike.mjs [cropDir [file,file]]   → markdown tables on stdout; with cropDir, 2x crops for viewing
import { mkdirSync, statSync } from 'node:fs';
import sharp from 'sharp';

const DIR = new URL('../src/assets/images/', import.meta.url).pathname;
const IMAGES = [
  ['apoptosis-micro-2.jpg', 'micro H&E'],
  ['caseous-necrosis-micro-2.jpg', 'micro H&E'],
  ['hyperplasia-micro-1.jpg', 'micro H&E'],
  ['dysplasia-micro-1.jpg', 'micro H&E, wide'],
  ['autophagy-micro-2.jpg', 'micro EM, grey'],
  ['coagulative-necrosis-gross-1.jpg', 'gross'],
  ['hypoxic-ischemic-injury-gross-1.jpg', 'gross, portrait'],
  ['gangrene-clinical-1.jpg', 'clinical photo'],
  ['protein-quality-control-diagram-1.png', 'diagram, PNG'],
  ['pyroptosis-diagram-1.jpg', 'diagram, JPEG'],
];
const WIDTHS = [480, 960, 1440];
const TODAY_WIDTHS = [480, 800, 1000, 1600]; // card page srcset (480, 800, 1600 or the original) + study page (1000)
const ENCODINGS = [
  ['WebP q80 (today)', 'webp', { quality: 80 }],
  ['WebP q70', 'webp', { quality: 70 }],
  ['WebP q60', 'webp', { quality: 60 }],
  ['AVIF q65', 'avif', { quality: 65 }],
  ['AVIF q60', 'avif', { quality: 60 }],
  ['AVIF q55', 'avif', { quality: 55 }],
  ['AVIF q50', 'avif', { quality: 50 }],
  ['AVIF q45', 'avif', { quality: 45 }],
  ['AVIF q55 4:2:0', 'avif', { quality: 55, chromaSubsampling: '4:2:0' }],
  ['AVIF q55 effort 2', 'avif', { quality: 55, effort: 2 }],
  ['AVIF q55 effort 3', 'avif', { quality: 55, effort: 3 }],
  ['AVIF q55 effort 6', 'avif', { quality: 55, effort: 6 }],
];

const raw = async (s) => {
  const { data, info } = await s.removeAlpha().toColourspace('srgb').raw().toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height };
};
const luma = ({ data, w, h }) => Float32Array.from({ length: w * h }, (_, i) => 0.299 * data[3 * i] + 0.587 * data[3 * i + 1] + 0.114 * data[3 * i + 2]);

function psnr(a, b) {
  let se = 0;
  for (let i = 0; i < a.length; i++) se += (a[i] - b[i]) ** 2;
  return se === 0 ? 99 : 10 * Math.log10((255 * 255) / (se / a.length));
}

function ssim(a, b, w, h) {
  const [c1, c2] = [(0.01 * 255) ** 2, (0.03 * 255) ** 2];
  let sum = 0;
  let n = 0;
  for (let y0 = 0; y0 + 8 <= h; y0 += 4)
    for (let x0 = 0; x0 + 8 <= w; x0 += 4) {
      let [sa, sb, saa, sbb, sab] = [0, 0, 0, 0, 0];
      for (let y = y0; y < y0 + 8; y++)
        for (let x = x0; x < x0 + 8; x++) {
          const [p, q] = [a[y * w + x], b[y * w + x]];
          sa += p; sb += q; saa += p * p; sbb += q * q; sab += p * q;
        }
      const [ma, mb] = [sa / 64, sb / 64];
      sum += ((2 * ma * mb + c1) * (2 * (sab / 64 - ma * mb) + c2)) / ((ma * ma + mb * mb + c1) * (saa / 64 - ma * ma + sbb / 64 - mb * mb + c2));
      n++;
    }
  return sum / n;
}

/** Top-left of the 240x180 window with the most edge energy (sum of |dx| + |dy|, coarse grid): where artefacts show. */
function busiest(y, w, h) {
  let best = { v: -1, x: 0, y: 0 };
  for (let y0 = 0; y0 + 181 <= h; y0 += 30)
    for (let x0 = 0; x0 + 241 <= w; x0 += 30) {
      let v = 0;
      for (let j = y0; j < y0 + 180; j++) for (let i = x0; i < x0 + 240; i++) v += Math.abs(y[j * w + i + 1] - y[j * w + i]) + Math.abs(y[(j + 1) * w + i] - y[j * w + i]);
      if (v > best.v) best = { v, x: x0, y: y0 };
    }
  return best;
}

/** 3x2 sheet of 2x crops: reference, WebP q80, WebP q70 / AVIF q65, q60, q55 (default chroma). */
async function writeCrops(file, ref, decoded, at) {
  mkdirSync(process.argv[2], { recursive: true });
  const tiles = [ref, ...[0, 1, 3, 4, 5].map((i) => decoded[i])];
  const composite = await Promise.all(
    tiles.map(async (t, i) => ({
      input: await sharp(t.data, { raw: { width: t.w, height: t.h, channels: 3 } }).extract({ left: at.x, top: at.y, width: 240, height: 180 }).resize({ width: 480, kernel: 'nearest' }).png().toBuffer(),
      left: (i % 3) * 484,
      top: Math.floor(i / 3) * 364,
    })),
  );
  const canvas = { create: { width: 1448, height: 724, channels: 3, background: '#808080' } };
  await sharp(canvas).composite(composite).png().toFile(`${process.argv[2]}/${file.replace(/\.\w+$/, '')}.png`);
}

const stats = new Map(); // `${encoding}|${width}` → { kb, psnr, ssim, ms, n }
const today = new Map(); // width in use → total bytes of WebP q80 over the images
const detail = [];
const only = process.argv[3]?.split(',');
for (const [file, kind] of IMAGES.filter(([f]) => !only || only.includes(f))) {
  const meta = await sharp(DIR + file).metadata();
  detail.push({ file, kind, size: `${meta.width}x${meta.height}`, source: statSync(DIR + file).size });
  for (const w of TODAY_WIDTHS) {
    const buf = await sharp(DIR + file).rotate().resize({ width: w, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
    today.set(w, (today.get(w) ?? 0) + buf.length);
  }
  for (const target of WIDTHS) {
    const base = sharp(DIR + file).rotate().resize({ width: target, withoutEnlargement: true });
    const ref = await raw(base.clone());
    const refY = luma(ref);
    const crops = [];
    for (const [label, format, options] of ENCODINGS) {
      const t0 = performance.now();
      const buf = await base.clone().toFormat(format, options).toBuffer();
      const ms = performance.now() - t0;
      const dec = await raw(sharp(buf));
      const s = stats.get(`${label}|${target}`) ?? { kb: 0, psnr: 0, ssim: 0, ms: 0, n: 0 };
      Object.assign(s, { kb: s.kb + buf.length / 1024, psnr: s.psnr + psnr(ref.data, dec.data), ssim: s.ssim + ssim(refY, luma(dec), ref.w, ref.h), ms: s.ms + ms, n: s.n + 1 });
      stats.set(`${label}|${target}`, s);
      crops.push(dec);
    }
    if (process.argv[2] && target === 960) await writeCrops(file, ref, crops, busiest(refY, ref.w, ref.h));
  }
}

console.log('| image | kind | size | source kB |\n|---|---|---|---:|');
for (const r of detail) console.log(`| ${r.file} | ${r.kind} | ${r.size} | ${Math.round(r.source / 1024)} |`);
const kb = (n) => Math.round(n / 1024);
console.log(`\ntoday (WebP q80 at the widths in use, total kB): ${TODAY_WIDTHS.map((w) => `${w}w ${kb(today.get(w))}`).join(', ')}; JPEG/PNG sources ${kb(detail.reduce((n, r) => n + r.source, 0))}`);
console.log('\n| encoding | kB 480 | kB 960 | kB 1440 | SSIM 480 | SSIM 960 | SSIM 1440 | PSNR 960 dB | s/image 960 | s/image 1440 |\n|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|');
for (const [label] of ENCODINGS) {
  const [a, b, c] = WIDTHS.map((w) => stats.get(`${label}|${w}`));
  console.log(`| ${label} | ${Math.round(a.kb)} | ${Math.round(b.kb)} | ${Math.round(c.kb)} | ${(a.ssim / a.n).toFixed(4)} | ${(b.ssim / b.n).toFixed(4)} | ${(c.ssim / c.n).toFixed(4)} | ${(b.psnr / b.n).toFixed(2)} | ${(b.ms / b.n / 1000).toFixed(2)} | ${(c.ms / c.n / 1000).toFixed(2)} |`);
}
