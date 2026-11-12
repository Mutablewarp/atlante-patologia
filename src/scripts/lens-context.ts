/**
 * Lens context (NAVIGATION_SPEC §3): with `?via=lens:term`, swap the default
 * breadcrumb and prev/next (organ-system order) for those of that lens term,
 * built from the JSON the page carries (src/lib/lens-context.ts, D069).
 * rel=canonical never changes.
 */
import { lensMarkup, type LensData } from '../lib/lens-context.ts';

const via = new URLSearchParams(location.search).get('via');
const json = via ? document.getElementById('lens-contexts')?.textContent : undefined;
const markup = via && json ? lensMarkup(JSON.parse(json) as LensData, via) : undefined;
if (markup) {
  const put = (slot: string, html: string) => {
    const target = document.querySelector<HTMLElement>(`[${slot}]`);
    if (target) target.innerHTML = html;
  };
  put('data-lens-crumb', markup.crumb);
  put('data-lens-nav', markup.nav);
  // The section list's last entry and the link under it (SectionToc.astro) lead to the next card of this context, or
  // hide when it has none.
  const next = document.querySelector<HTMLAnchorElement>('[data-lens-nav] a[rel="next"]');
  document.querySelectorAll<HTMLElement>('[data-next-entry]').forEach((el) => (el.hidden = !next));
  document.querySelectorAll('[data-next-name]').forEach((el) => (el.textContent = next?.dataset.name ?? ''));
  document.querySelectorAll<HTMLAnchorElement>('[data-next-link]').forEach((a) => {
    if (!next) return a.removeAttribute('href');
    a.href = next.href;
    if (a.dataset.label) a.setAttribute('aria-label', a.dataset.label.replace('{name}', next.dataset.name ?? ''));
  });
}

export {};
