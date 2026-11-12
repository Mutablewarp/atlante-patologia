/**
 * Lens context (NAVIGATION_SPEC §3, D069): the breadcrumb and previous/next cards of an entity page for each lens term
 * the card belongs to. The page carries them as compact JSON (`LensData`); with `?via=lens:term` lens-context.ts calls
 * `lensMarkup` and swaps the result in. The markup is that of Breadcrumb.astro, CardPager.astro and the links at the end of
 * the card ([id].astro): tests/e2e/nav.spec.ts checks that the two agree.
 */
type Neighbour = [id: string, name: string] | null;

export type LensData = {
  /** `/base/lang/` */
  base: string;
  /** Name of the card, in the page language. */
  name: string;
  /** Texts shared by all contexts; `prevIn` and `nextIn` hold `{term}`. */
  s: { crumb: string; atlas: string; prevCard: string; nextCard: string; prevIn: string; nextIn: string };
  /** `lens:term` → [lens label, term label, previous card, next card] */
  c: Record<string, [lens: string, term: string, prev: Neighbour, next: Neighbour]>;
};

const esc = (s: string) => s.replace(/[&<>"]/g, (ch) => `&#${ch.charCodeAt(0)};`);

/** Breadcrumb with the pager beside it (`crumb`) and the links at the end of the card (`nav`, empty when there is no neighbour). */
export function lensMarkup(d: LensData, via: string): { crumb: string; nav: string } | undefined {
  if (!Object.hasOwn(d.c, via)) return undefined;
  const [lensLabel, termLabel, prev, next] = d.c[via]!;
  const [lens, term] = via.split(':');
  const to = (id: string) => `${d.base}e/${id}/?via=${via}`;
  const crumbs = [
    [d.s.atlas, `${d.base}atlas/`],
    [lensLabel, `${d.base}atlas/${lens}/`],
    [termLabel, `${d.base}atlas/${lens}/${term}/`],
  ]
    .map(([label, href]) => `<li><a href="${esc(href!)}">${esc(label!)}</a></li>`)
    .join('');
  const breadcrumb = `<nav class="breadcrumb" aria-label="${esc(d.s.crumb)}"><ol>${crumbs}<li><span aria-current="page">${esc(d.name)}</span></li></ol></nav>`;
  if (!prev && !next) return { crumb: breadcrumb, nav: '' };

  const pager =
    '<p class="pager" data-pagefind-ignore>' +
    (prev ? `<a href="${esc(to(prev[0]))}"><span aria-hidden="true">← </span><span class="visually-hidden">${esc(d.s.prevCard)}: </span>${esc(prev[1])}</a>` : '') +
    (prev && next ? '<span aria-hidden="true">·</span>' : '') +
    (next ? `<a href="${esc(to(next[0]))}"><span class="visually-hidden">${esc(d.s.nextCard)}: </span>${esc(next[1])}<span aria-hidden="true"> →</span></a>` : '') +
    '</p>';
  const label = (template: string) => esc(template.replace('{term}', () => termLabel));
  const links =
    (prev ? `<a rel="prev" href="${esc(to(prev[0]))}"><span class="small muted">${label(d.s.prevIn)}</span><span>← ${esc(prev[1])}</span></a>` : '') +
    (next ? `<a rel="next" href="${esc(to(next[0]))}" data-name="${esc(next[1])}"><span class="small muted">${label(d.s.nextIn)}</span><span>${esc(next[1])} →</span></a>` : '');
  return { crumb: breadcrumb + pager, nav: `<nav class="prev-next" aria-label="${esc(termLabel)}">${links}</nav>` };
}
