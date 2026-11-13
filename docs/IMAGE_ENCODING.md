# Image encoding

Decided 2026-11-12 (V3 plan I-6, with decision D8; settles D026). Spike: `node scripts/image-spike.mjs [cropDir]`, sharp 0.35.5, on a shared Mac under heavy load: bytes and scores are exact, seconds only indicative. 1 MB = 1,048,576 bytes, 1 kB = 1,024.

## Spike: 10 images of `src/assets/images`

Micrographs `apoptosis-micro-2` (1024×768), `caseous-necrosis-micro-2` (1600×1041), `hyperplasia-micro-1` (1600×1159), `dysplasia-micro-1` (1600×640), `autophagy-micro-2` (electron micrograph, grey, 600×617). Gross and clinical: `coagulative-necrosis-gross-1` (1600×1083), `hypoxic-ischemic-injury-gross-1` (986×1377), `gangrene-clinical-1` (1280×849). Diagrams: `protein-quality-control-diagram-1` (PNG, 1600×1250), `pyroptosis-diagram-1` (JPEG, 784×576).

Reference: the source resized with sharp's defaults, as Astro does. PSNR on RGB, SSIM on luma (8×8 windows), both on decoded buffers. Sizes are totals for the ten, each capped at its own width.

| Encoding | kB at 480 | kB at 960 | kB at 1440 | SSIM at 960 | SSIM at 1440 | PSNR at 960 | s per image at 960 |
|---|---:|---:|---:|---:|---:|---:|---:|
| WebP q80 (today) | 420 | 1152 | 1769 | 0.9840 | 0.9846 | 36.20 | 0.10 |
| WebP q70 | 339 | 923 | 1412 | 0.9755 | 0.9763 | 34.45 | 0.10 |
| WebP q60 | 304 | 827 | 1266 | 0.9708 | 0.9717 | 33.67 | 0.08 |
| AVIF q65 | 319 | 889 | 1350 | 0.9819 | 0.9856 | 36.57 | 0.87 |
| AVIF q60 | 283 | 785 | 1200 | 0.9780 | 0.9822 | 35.72 | 0.97 |
| AVIF q55 | 232 | 643 | 989 | 0.9702 | 0.9752 | 34.40 | 0.92 |
| AVIF q50 | 197 | 545 | 841 | 0.9627 | 0.9685 | 33.50 | 0.82 |
| AVIF q45 | 164 | 455 | 702 | 0.9523 | 0.9591 | 32.44 | 0.86 |
| AVIF q55, chroma 4:2:0 | 225 | 616 | 944 | 0.9700 | 0.9750 | 33.73 | 0.76 |
| AVIF q55, effort 2 | 232 | 669 | 1052 | 0.9679 | 0.9739 | 33.96 | 0.11 |
| AVIF q55, effort 3 | 224 | 641 | 1001 | 0.9688 | 0.9745 | 34.18 | 0.13 |
| AVIF q55, effort 6 | 230 | 637 | 982 | 0.9717 | 0.9767 | 34.78 | 1.97 |

AVIF rows use sharp's default effort 4 and 4:4:4 unless named. Today's files for the same ten: WebP q80 at 480, 800, 1000 (study pages) and 1600 px or the original: 420, 912, 1224 and 1917 kB, plus 2461 kB of original JPEG/PNG that Astro also copied to `dist/` and no page loaded. Re-encoding all 76 sources this way reproduces the build: 257 WebP files, 22.5 MB, and 16.6 MB of originals.

Crops (960 px wide, the 240×180 px window with the most edges, 2× nearest neighbour, six encodings per sheet; looked at by one viewer, the agent that ran the spike):
- Micrograph `caseous-necrosis-micro-2`: WebP q80 and q70 look like the reference (q70 faintly grainy in the pale centre). AVIF q65 and q60 keep the small dark nuclei apart and the faint chromatin of the pale cells; q55 smooths that chromatin a little, nuclei stay distinct. An earlier sheet with q45 (`apoptosis-micro-2`) lost nucleolar and chromatin detail.
- Gross `coagulative-necrosis-gross-1`: the fine light speckle of the dark granular patch survives at q65, is a touch fainter at q60 and slightly waxy at q55; the vessel lumen, fibrous strands and colours do not change; no blocking.
- Diagram `protein-quality-control-diagram-1`: lines, arrowheads, the numbered disc and the flat grey stay sharp in every encoding; no ringing or banding.

## Decision

Per raster image the build emits three files (`src/lib/image-meta.ts`, `src/lib/picture.ts`):
1. **Page file**: AVIF, 960 px (the original's width when narrower), quality 60. SSIM 0.978, PSNR 35.7 dB: 32 % fewer bytes than WebP q80 (785 against 1152 kB) for 0.006 SSIM, and 15 % fewer than WebP q70 at a higher SSIM. Every page and the study tools load this one file by default, on any screen.
2. **Fallback**: WebP, 640 px, quality 60 (37 kB), the `<img>` of the `<picture>`, for browsers without AVIF. The study tools share it, so they add no files.
3. **Zoom file**: AVIF at the original width, quality 55 (SSIM 0.975 at 1440 px), only for originals wider than 1200 px (41 of 76). The viewer swaps it in past 1.5× and in full screen (`data-zoom` on the `<source>`); nobody else downloads it. Offline packs list it (`imagesIn`).

Why:
- Floor of SSIM 0.975 for the AVIF files (the WebP fallback, 0.971, only serves browsers without AVIF). q45 (0.952) visibly loses chromatin detail; q50 (0.963) I did not look at.
- One page width, not two: the slot measures 375 to 589 px (Chrome, 375–1920 px viewports) on 1× to 3× screens, so a browser would pick 480 px only on a roughly 1× phone. It would cost 26 kB per image (30 MB at 1,210 images). `sizes` was `46rem` from 1024 px; now `(max-width: 599px) 100vw, 37rem`. With one candidate it does not change the choice.
- Effort 3 (`astro.config.mjs`): the same bytes as sharp's default 4 (within 1 %) in a seventh of the time. A cold `npm run build` took 23 s of CPU before, 249 s with effort 4, 57 s with effort 3 (205 image files). At 1,210 images that is about 12 CPU-minutes against about 60: 3 or 15 minutes on 4 cores, and the CI job's limit is 15 (estimates from this Mac).
- 4:4:4 chroma kept: 4:2:0 saves 4 %; my reason is the colour edges between eosin and haematoxylin, which I did not test.
- The original files: Astro kept all 76 (16.6 MB) because our code read their size from the imported object. `plain()` reads a clone, and `tests/dist/image-weight.test.ts` fails if one comes back. That alone is 223 kB per image.

## Result and projection

- Measured, 26 cards: images in `dist/` 39.1 MB → 12.8 MB (526 → 172 kB per image: page 67, zoom 68 averaged over all 76, fallback 37); `dist/` 57.6 → 31.4 MB. A card loads 197 kB of images on average, 327 kB at most, on any screen; before 212 kB (max 364) on a 1× desktop and 412 kB (max 923) on a 2× screen. Offline pack g01 (it) 21.4 → 17.0 MB.
- Cap: `tests/dist/image-weight.test.ts`, 450 kB for a card with at most 3 images (heaviest of them: 287 kB; no allowlist needed).
- Estimate for 404 cards: 76 + 378 × 3 (the cap) = 1,210 images × 172 kB = 204 MB; today's encoding 622 MB. V2.2: the brief says 85 added images; its branch `content/g01-v22` has 100 more raster files than main (26.6 MB of sources), which this pipeline turns into 203 kB each (measured), so +17 MB (85) or +20 MB (100): 221–224 MB; today's encoding would add 54–63 MB (estimate). With 6 images on all 404 cards: 2,424 × 172–203 kB = 407–480 MB, over the budget: the cap of 3 holds the line.
- D026's first option (AVIF and WebP at 480 and 960 px plus the zoom file): 246 kB per image, 290 MB, above its 220 MB threshold. This is its second option.
- Site total: images 221 MB + 808 card pages × 113 kB (measured mean) = 89 MB + search index about 11 MB (the plan's estimate, not re-measured) ≈ 321 MB before the body assets. Inside 400 MB.

Not verified: Firefox and Safari engines (Chrome only); a real phone at 3×; the AVIF fallback in a browser without AVIF; CI cold-build time.
