// @ts-check
import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';
import sitemap from '@astrojs/sitemap';

// GitHub Pages project site: https://mutablewarp.github.io/atlante-patologia/
export default defineConfig({
  site: 'https://mutablewarp.github.io',
  base: '/atlante-patologia',
  trailingSlash: 'always',
  build: { format: 'directory' },
  // AVIF effort 3: the same bytes as sharp's default 4 (within 1 %) in about a quarter of the time (249 s against 57 s of CPU
  // on the same 205 files), which keeps a cold CI build under the job's time limit (docs/IMAGE_ENCODING.md).
  image: { service: { entrypoint: 'astro/assets/services/sharp', config: { avif: { effort: 3 } } } },
  i18n: {
    locales: ['it', 'en'],
    defaultLocale: 'it',
    routing: { prefixDefaultLocale: true, redirectToDefaultLocale: false },
  },
  integrations: [
    preact(),
    sitemap({
      // Same codes as the <link rel="alternate" hreflang> tags in BaseLayout.
      i18n: { defaultLocale: 'it', locales: { it: 'it', en: 'en' } },
      // The root `/` is only a language picker (D027), not an Italian page; 404 and the
      // offline fallback (served by the service worker) are not landing pages.
      filter: (page) =>
        !page.endsWith('/404/') && !/\/(it|en)\/offline\/$/.test(page) && new URL(page).pathname !== '/atlante-patologia/',
    }),
  ],
  devToolbar: { enabled: false },
});
