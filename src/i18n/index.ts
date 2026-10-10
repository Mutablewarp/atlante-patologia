/**
 * Tiny typed i18n core. Every feature keeps its own string module
 * (nav.ts, common.ts, about.ts, …) built with `defineStrings`, so parallel
 * work never touches one shared giant file.
 *
 *   export const tNav = defineStrings({ home: { it: 'Home', en: 'Home' } });
 *   tNav(lang, 'home');
 */
export const LANGS = ['it', 'en'] as const;
export type Lang = (typeof LANGS)[number];
export const DEFAULT_LANG: Lang = 'it';

/** A user-visible string in both languages. */
export type L = { it: string; en: string };

export function isLang(value: unknown): value is Lang {
  return typeof value === 'string' && (LANGS as readonly string[]).includes(value);
}

export function otherLang(lang: Lang): Lang {
  return lang === 'it' ? 'en' : 'it';
}

/** Pick the language variant of a bilingual value (content data or UI string). */
export function pick<T>(lang: Lang, value: { it: T; en: T }): T {
  return value[lang];
}

/** Build a typed `t(lang, key)` for one string module. */
export function defineStrings<const D extends Record<string, L>>(dict: D) {
  const t = (lang: Lang, key: keyof D & string): string => dict[key][lang];
  return Object.assign(t, { dict });
}

/** Simple `{name}` interpolation. */
export function fmt(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => String(values[k] ?? `{${k}}`));
}

/** Static paths for every `[lang]` route. */
export function langPaths() {
  return LANGS.map((lang) => ({ params: { lang } }));
}

export const LOCALE_TAG: Record<Lang, string> = { it: 'it-IT', en: 'en-GB' };

export function formatDate(lang: Lang, date: Date): string {
  return new Intl.DateTimeFormat(LOCALE_TAG[lang], { dateStyle: 'medium', timeZone: 'UTC' }).format(date);
}
