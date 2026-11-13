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
- Effort 3 (`astro.config.mjs`): the same bytes as sharp's default 4 (within 1 %) in about a quarter of the time. A cold `npm run build` of the 205 image files of the 26 cards before V2.2 took 23 s of CPU before this work, 249 s with effort 4, 57 s with effort 3 (measured on this Mac; not repeated with V2.2's 469 files, whose build here ran on a warm cache). Scaled by file count to 404 cards (about 7,600 files) that is about 35 CPU-minutes against about 150: 9 or 38 minutes on 4 cores, and the CI job's limit is 15 (estimate).
- 4:4:4 chroma kept: 4:2:0 saves 4 %; my reason is the colour edges between eosin and haematoxylin, which I did not test.
- The original files: Astro kept all 76 (16.6 MB) because our code read their size from the imported object. `plain()` reads a clone, and `tests/dist/image-weight.test.ts` fails if one comes back. That alone is 223 kB per image.

## Result and projection

Measured: the first three bullets, from the built `dist/` on 2026-11-13 (26 cards, two languages, 52 entity pages, V2.2 included). Estimated: every figure that says "404 cards". "Image" is one raster image (page file, fallback and optional zoom file); the SVG diagrams are counted apart.

- Measured, `dist/`: 1,216 files, 54.1 MB. 469 image files (281 AVIF, 188 WebP) weigh 32.8 MB, 0.15 MB of them the 12 pathway poster files: 177 raster images, 189 kB each. No original JPEG or PNG is in `dist/` (its 4 PNGs are the app icons). Before V2.2, with 76 images: 172 kB each, `dist/` 31.4 MB.
- Measured, entity pages: every card has 6 to 9 images in its viewer figures (6: 4 pages, 7: 32, 8: 14, 9: 2); mean 7.27 per page (378 in 52 pages: 354 raster, 24 SVG; 6.81 raster). The default load is 493 kB per card on average and 768 kB at most (`/en/e/intracellular-accumulations/`, 7 images).
- Cap: `tests/dist/image-weight.test.ts`, 450 kB for a card with at most 3 images. No card is that small now, so today the cap checks no card; cards with more images have no cap.
- Estimate for 404 cards: 404 × 6.81 raster images = 2,751 × 189 kB = 508 MB of images (1.26 MB per card), over the 400 MB budget by itself. It assumes the 26 cards are typical. The earlier estimate (1,210 images, 204 MB) assumed at most 3 images per card. Under 400 MB needs a mean of about 5 images per card, or about 140 kB per image, or a larger budget: the owner's decision. At the cap of the content brief (`docs/agents/BRIEF.md`: at most 3 images per new card) the estimate is 378 new cards × 3 × 189 kB = 214 MB, plus the 26 V2.2 cards at 7.27 images (about 36 MB): about 250 MB of images, inside the budget. The V2.2 cards are the outliers.
- Estimate: D026's first option (AVIF and WebP at 480 and 960 px plus the zoom file) costs about 246 kB per image (spike), so about 650 MB at 2,751 images. This pipeline is its second option.
- Site total at 404 cards: at the 3-image cap, about 250 MB of images plus about 100 MB of card HTML (ARCHITECTURE §8) is about 350 MB: tight against the 400 MB budget, before the search index and the other pages, which are not estimated. At the 7.27 images of the V2.2 cards it would be over 400 MB with the images alone.

Pathway posters (`StructureViewer.astro`) stay on `<Image>` from `astro:assets`: 12 files (320 and 640 px WebP), 0.15 MB in all, at most 112 kB on a pathway page (4 pages), so a `pictureFiles` conversion would save under 0.1 MB.

Not verified: Firefox and Safari engines (Chrome only); a real phone at 3×; the AVIF fallback in a browser without AVIF; CI cold-build time.
