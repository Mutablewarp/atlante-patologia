import { describe, expect, it } from 'vitest';
import { imagesIn, isLazyCached, isShellAsset, LAZY_ONLY, versionOf } from '../scripts/sw-manifest.mjs';

describe('sw-manifest imagesIn', () => {
  it('collects same-site images from src, srcset and href, relative to the base', () => {
    const html = `
      <img src="/b/_astro/a.H1.webp" alt="">
      <img srcset="/b/_astro/s.1.avif 400w, /b/_astro/s.2.avif 800w" src="/b/img/x.jpg?v=1">
      <a href="/b/media/full.png#zoom">full</a>
      <a href="/b/it/atlas/">page</a>
      <img src="https://example.org/remote.png">
      <script src="/b/_astro/app.js"></script>`;
    expect(imagesIn(html, '/b/').sort()).toEqual(
      ['_astro/a.H1.webp', '_astro/s.1.avif', '_astro/s.2.avif', 'img/x.jpg', 'media/full.png'].sort(),
    );
  });

  it('keeps the picture of an image offline: its AVIF source, the WebP fallback and the file the viewer swaps in on zoom', () => {
    const html = `<picture><source type="image/avif" srcset="/b/_astro/p.AAAAAAAA_1.avif 960w" sizes="100vw" data-zoom="/b/_astro/p.AAAAAAAA_2.avif 1600w">
      <img src="/b/_astro/p.AAAAAAAA_3.webp" alt="" width="1600" height="1200"></picture>
      <source data-zoom="https://example.org/far.avif 1600w">`;
    expect(imagesIn(html, '/b/').sort()).toEqual(['_astro/p.AAAAAAAA_1.avif', '_astro/p.AAAAAAAA_2.avif', '_astro/p.AAAAAAAA_3.webp']);
  });
});

describe('sw-manifest shell assets', () => {
  it('precaches hashed CSS/JS/fonts but never the lazily imported 3Dmol chunk or structure files', () => {
    expect(isShellAsset('_astro/BaseLayout.astro_astro_type_script_index_0_lang.DUbkG10_.js')).toBe(true);
    expect(isShellAsset('_astro/Pathway.astro_astro_type_script_index_0_lang.CsmH7j_W.js')).toBe(true);
    expect(isShellAsset('_astro/fraunces-latin.woff2')).toBe(true);
    expect(isShellAsset('_astro/structure-3d.CmaSPdvp.js')).toBe(false);
    expect(isShellAsset('structures/3jbt.bcif.gz')).toBe(false);
    expect(LAZY_ONLY.test('_astro/structure-3d.CmaSPdvp.js')).toBe(true);
  });
});

describe('sw-manifest version', () => {
  it('a structure file or the 3Dmol chunk changes the worker version without being precached', () => {
    expect(isLazyCached('structures/6o0k.bcif.gz')).toBe(true);
    expect(isLazyCached('_astro/structure-3d.DkWQqcJc.js')).toBe(true);
    expect(isLazyCached('_astro/index.abc.css')).toBe(false);
    const shell = { 'it/': 'aaaa' };
    expect(versionOf({ ...shell, 'structures/6o0k.bcif.gz': '1111' })).not.toBe(versionOf({ ...shell, 'structures/6o0k.bcif.gz': '2222' }));
  });
});

