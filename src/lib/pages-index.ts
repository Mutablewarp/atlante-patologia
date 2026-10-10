/** Main site pages for the command palette (titles reuse the page string modules). */
import type { Lang } from '../i18n/index.ts';
import { TABS, TAB_ROOT, tNav } from '../i18n/nav.ts';
import { tAtlas } from '../i18n/pages.ts';
import { tHz } from '../i18n/horizontal.ts';
import { ABOUT_PAGES, ABOUT_INDEX } from '../i18n/about.ts';
import { langPath } from './url.ts';

export function sitePages(lang: Lang): { title: string; url: string }[] {
  return [
    ...TABS.map((tab) => ({ title: tNav(lang, tab), url: langPath(lang, TAB_ROOT[tab]) })),
    { title: tAtlas(lang, 'azTitle'), url: langPath(lang, 'atlas/az/') },
    { title: tHz(lang, 'compareTitle'), url: langPath(lang, 'compare/') },
    { title: tHz(lang, 'diffTitle'), url: langPath(lang, 'differential/') },
    { title: tHz(lang, 'mapTitle'), url: langPath(lang, 'map/') },
    { title: tHz(lang, 'pathsTitle'), url: langPath(lang, 'paths/') },
    { title: ABOUT_INDEX.title[lang], url: langPath(lang, 'about/') },
    ...Object.entries(ABOUT_PAGES).map(([slug, p]) => ({ title: p.title[lang], url: langPath(lang, `about/${slug}/`) })),
  ];
}
