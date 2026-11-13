/**
 * Image weight per card (V3 plan I-6 and §1): the images an entity page loads by default weigh at most 450 kB
 * for a card with at most 3 images. "Default" is the file every browser fetches without zooming: the largest
 * candidate of the AVIF <source> of a <picture> (the WebP fallback is smaller), or the `src` of a plain <img>
 * (the SVG diagrams). The zoom source (`data-zoom`) is not counted: only the image viewer asks for it.
 * Counted: the figures of the image viewer. Structure posters on pathway blocks are a separate, small render.
 * Bytes are the files' sizes on disk, as GitHub Pages serves them.
 */
import { statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DIST, internalUrl, isEntity, pages, resolveFile, walk } from './lib.ts';

const KB = 1024;
const CARD_MAX = 450 * KB;
const MAX_IMAGES = 3;
/** Cards that cannot reach the cap yet (page URL → TODO date to re-encode or trim). Try a lower quality in src/lib/image-meta.ts first. */
const ALLOWED: Record<string, string> = {};

const FIGURE = /<figure class="viewer-figure"[\s\S]*?<\/figure>/g;
const PICTURE = /<picture>[\s\S]*?<\/picture>/g;
/** The widest candidate of a `srcset` value. */
const widest = (set: string) =>
  set
    .split(',')
    .map((c) => c.trim().split(/\s+/))
    .reduce((a, b) => (parseInt(b[1] ?? '0') > parseInt(a[1] ?? '0') ? b : a))[0]!;

/** The URL of the default file of each image of a page: one per <picture> and per plain <img> inside a viewer figure. */
function defaultUrls(html: string): string[] {
  return [...html.matchAll(FIGURE)].flatMap(([figure]) => {
    const pictures = [...figure.matchAll(PICTURE)].map(([p]) => {
      const set = /<source\b[^>]*\ssrcset="([^"]+)"/.exec(p)?.[1];
      return set ? widest(set) : /<img\b[^>]*\ssrc="([^"]+)"/.exec(p)![1]!;
    });
    const plain = [...figure.replace(PICTURE, '').matchAll(/<img\b[^>]*\ssrc="([^"]+)"/g)].map((m) => m[1]!);
    return [...pictures, ...plain];
  });
}

describe('image weight per card', () => {
  const cards = pages()
    .filter((p) => isEntity(p.url))
    .map((p) => {
      const urls = defaultUrls(p.html);
      const bytes = urls.reduce((n, u) => {
        const file = resolveFile(internalUrl(u, p.url)?.pathname ?? '');
        if (!file) throw new Error(`${p.url}: image ${u} is not in dist/`);
        return n + statSync(file).size;
      }, 0);
      const figures = [...p.html.matchAll(FIGURE)].map((m) => m[0]);
      const inFigures = figures.reduce((n, f) => n + (f.match(/<img\b/g)?.length ?? 0), 0);
      return { url: p.url.replace('/atlante-patologia/', '/'), images: urls.length, bytes, figures: figures.length, inFigures };
    });

  it('counts every image of every viewer figure, at least one per page that has a figure', () => {
    const wrong = cards
      .filter((c) => c.figures > 0 && (c.images < 1 || c.images !== c.inFigures))
      .map((c) => `${c.url}: counted ${c.images}, ${c.inFigures} <img> in ${c.figures} figures`);
    expect(wrong).toEqual([]);
  });

  it('finds the images of the cards', () => {
    expect(cards.length).toBeGreaterThan(0);
    expect(cards.filter((c) => c.images > 0).length).toBeGreaterThan(0);
  });

  it(`a card with at most ${MAX_IMAGES} images loads at most ${CARD_MAX / KB} kB of them by default`, () => {
    const heaviest = [...cards].sort((a, b) => b.bytes - a.bytes)[0]!;
    console.info(`heaviest card images: ${heaviest.url} ${(heaviest.bytes / KB).toFixed(0)} kB in ${heaviest.images} images`);
    const over = cards.filter((c) => c.images <= MAX_IMAGES && c.bytes > CARD_MAX && !(c.url in ALLOWED));
    expect(over.map((c) => `${c.url}: ${(c.bytes / KB).toFixed(0)} kB in ${c.images} images > ${CARD_MAX / KB} kB`)).toEqual([]);
  });

  it('keeps the original JPEG and PNG files out of dist/: no page uses them (src/lib/picture.ts, `plain`)', () => {
    const originals = walk().filter((f) => /\/_astro\/[^/]+\.(jpe?g|png)$/i.test(f));
    expect(originals.map((f) => f.slice(DIST.length + 1))).toEqual([]);
  });

  it('the allowlist holds only cards that still need it', () => {
    for (const url of Object.keys(ALLOWED)) {
      const card = cards.find((c) => c.url === url);
      expect(card, `${url} is not a built card`).toBeDefined();
      expect(card!.images <= MAX_IMAGES && card!.bytes > CARD_MAX, `${url} is within the cap: remove it from ALLOWED`).toBe(true);
    }
  });
});
