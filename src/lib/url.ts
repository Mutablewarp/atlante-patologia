/**
 * The ONLY way to build internal URLs. Prefixes the configured base
 * (`/atlante-patologia/` on GitHub Pages) and keeps trailing slashes.
 */
import type { Lang } from '../i18n/index.ts';
import { LANGS } from '../i18n/index.ts';

/** Pure join used by `url()`; exported for tests. Keeps `?query` and `#hash`. */
export function joinBase(base: string, path = ''): string {
  const b = base.endsWith('/') ? base : `${base}/`;
  const p = path.replace(/^\/+/, '');
  const [pathname = '', rest = ''] = splitSuffix(p);
  // Directory-style routes get a trailing slash; files (with an extension) do not.
  const needsSlash = pathname !== '' && !pathname.endsWith('/') && !/\.[a-z0-9]+$/i.test(pathname);
  return `${b}${pathname}${needsSlash ? '/' : ''}${rest}`.replace(/\/{2,}/g, '/');
}

function splitSuffix(p: string): [string, string] {
  const i = p.search(/[?#]/);
  return i === -1 ? [p, ''] : [p.slice(0, i), p.slice(i)];
}

export function url(path = ''): string {
  return joinBase(import.meta.env.BASE_URL, path);
}

/** `/base/{lang}/{path}` */
export function langPath(lang: Lang, path = ''): string {
  return url(`${lang}/${path.replace(/^\/+/, '')}`);
}

/** Strip base and language prefix: `/atlante-patologia/it/atlas/` → `atlas/`. */
export function stripLang(pathname: string, base: string = import.meta.env.BASE_URL): string {
  const b = base.endsWith('/') ? base : `${base}/`;
  const rest = pathname.startsWith(b) ? pathname.slice(b.length) : pathname.replace(/^\/+/, '');
  const [first, ...tail] = rest.split('/');
  return (LANGS as readonly string[]).includes(first ?? '') ? tail.join('/') : rest;
}

/** Same page in another language (language switch, hreflang). */
export function alternate(lang: Lang, pathname: string): string {
  return langPath(lang, stripLang(pathname));
}
