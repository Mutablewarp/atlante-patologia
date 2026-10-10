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
      i18n: { defaultLocale: 'it', locales: { it: 'it-IT', en: 'en-GB' } },
      filter: (page) => !page.endsWith('/404/'),
    }),
  ],
  devToolbar: { enabled: false },
});
