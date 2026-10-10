import { describe, expect, it } from 'vitest';
import { imagesIn } from '../scripts/sw-manifest.mjs';

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
});
