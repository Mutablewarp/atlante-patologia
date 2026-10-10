import { defineStrings } from './index.ts';

/** The five primary destinations (NAVIGATION_SPEC §1). Order is the tab order. */
export const TABS = ['home', 'atlas', 'study', 'search', 'me'] as const;
export type Tab = (typeof TABS)[number];

/** Path of each tab's root, relative to `/{lang}/`. */
export const TAB_ROOT: Record<Tab, string> = {
  home: '',
  atlas: 'atlas/',
  study: 'study/',
  search: 'search/',
  me: 'me/',
};

export const tNav = defineStrings({
  home: { it: 'Home', en: 'Home' },
  atlas: { it: 'Atlante', en: 'Atlas' },
  study: { it: 'Studio', en: 'Study' },
  search: { it: 'Cerca', en: 'Search' },
  me: { it: 'Profilo', en: 'Me' },
  primaryNav: { it: 'Navigazione principale', en: 'Main navigation' },
  collapse: { it: 'Riduci la barra laterale', en: 'Collapse sidebar' },
  expand: { it: 'Espandi la barra laterale', en: 'Expand sidebar' },
  searchPlaceholder: { it: 'Cerca nell’atlante…', en: 'Search the atlas…' },
  searchLabel: { it: 'Cerca nell’atlante', en: 'Search the atlas' },
  searchSubmit: { it: 'Cerca', en: 'Search' },
  shortcutHint: { it: 'Scorciatoia: Ctrl o ⌘ + K', en: 'Shortcut: Ctrl or ⌘ + K' },
});
