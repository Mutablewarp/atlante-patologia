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
      // The root `/` is only a language picker (D027), not an Italian page.
      filter: (page) => !page.endsWith('/404/') && new URL(page).pathname !== '/atlante-patologia/',
    }),
  ],
  devToolbar: { enabled: false },
});
