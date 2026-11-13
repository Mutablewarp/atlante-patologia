/**
 * The files behind one teaching image (docs/IMAGE_ENCODING.md): an AVIF for the page, a small WebP for browsers
 * without AVIF and, for a large original, an AVIF at its own width that only the zoom viewer asks for. Card pages
 * and the study tools both call this, so each file is built once and shared.
 */
import { getImage } from 'astro:assets';
import type { ImageMetadata } from 'astro';
import { IMAGE_OUT, imagePlan } from './image-meta.ts';

/**
 * The imported image's own data. Read it from here, not from the import: touching the import makes Astro keep the
 * original file in dist/, where nothing uses it (about 220 kB per image).
 */
export const plain = (meta: ImageMetadata): ImageMetadata => (meta as ImageMetadata & { clone?: ImageMetadata }).clone ?? meta;

export async function pictureFiles(meta: ImageMetadata) {
  const { width, height } = plain(meta);
  const plan = imagePlan(width);
  const [page, fallback, zoom] = await Promise.all([
    getImage({ src: meta, width: plan.page, format: 'avif', quality: IMAGE_OUT.page.quality }),
    getImage({ src: meta, width: plan.fallback, format: 'webp', quality: IMAGE_OUT.fallback.quality }),
    plan.zoom ? getImage({ src: meta, width: plan.zoom, format: 'avif', quality: IMAGE_OUT.zoom.quality }) : undefined,
  ]);
  return {
    width,
    height,
    /** `srcset` of the AVIF <source>: one candidate, the same file for every screen. */
    avifSet: `${page.src} ${plan.page}w`,
    webp: fallback.src,
    /** `srcset` the viewer swaps in on zoom; absent when the page file is as sharp as the original. */
    zoomSet: zoom ? `${zoom.src} ${plan.zoom}w` : undefined,
  };
}
