/**
 * Markdown cross-links (D038), resolved on the rendered HTML so they work with
 * any Markdown processor (same approach as sections.ts, D030):
 *   [[entity-id]]          → link if the entity is visible, else name + "planned"
 *   [[entity-id|label]]    → same, with custom text
 *   [[g:glossary-id]]      → glossary term button + popover with the definition
 * The Markdown processor leaves `[[…]]` as literal text (no reference definition).
 */
import type { Lang, L } from '../i18n/index.ts';

export type CrossLinkCtx = {
  lang: Lang;
  /** Visible (linkable) entity id → URL. */
  entityUrl: (id: string) => string | undefined;
  /** Any known name: visible, draft or planned entity. */
  entityName: (id: string) => string | undefined;
  glossary: ReadonlyMap<string, { term: L; definition: L }>;
  /** A–Z URL of a glossary term (with #anchor). */
  glossaryUrl: (id: string) => string;
  strings: { planned: string; glossary: string; az: string };
  /** Prefix that keeps popover ids unique within one page. */
  idPrefix?: string;
};

const LINK = /\[\[(g:)?([a-z0-9]+(?:-[a-z0-9]+)*)(?:\|([^\]]+))?\]\]/g;

/** Claim markers (`<!--c:id-->`) are for the gates, which read them from the Markdown; the built page does not need them. */
export const dropClaimMarkers = (html: string) => html.replace(/<!--\s*c:[a-z0-9-]+\s*-->/g, '');
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const humanize = (id: string) => id.replace(/-/g, ' ');

export function resolveCrossLinks(html: string, ctx: CrossLinkCtx): string {
  let n = 0;
  return html.replace(LINK, (_m, g: string | undefined, id: string, label: string | undefined) => {
    if (g) {
      const entry = ctx.glossary.get(id);
      // `label` comes from rendered HTML, so it is already escaped.
      const text = label ?? esc(entry?.term[ctx.lang] ?? humanize(id));
      if (!entry) return text;
      const pid = `${ctx.idPrefix ?? 'gloss'}-${id}-${++n}`;
      return (
        `<span class="gloss"><button type="button" class="gloss-term" popovertarget="${pid}">${text}</button>` +
        `<span class="gloss-pop" id="${pid}" popover role="note" aria-label="${esc(ctx.strings.glossary)}">` +
        `<strong>${esc(entry.term[ctx.lang])}</strong> ${esc(entry.definition[ctx.lang])} ` +
        `<a href="${esc(ctx.glossaryUrl(id))}">${esc(ctx.strings.az)}</a></span></span>`
      );
    }
    const href = ctx.entityUrl(id);
    const text = label ?? esc(ctx.entityName(id) ?? humanize(id));
    if (href) return `<a href="${esc(href)}" class="xref">${text}</a>`;
    return `<span class="xref-planned">${text} <span class="badge badge-planned">${esc(ctx.strings.planned)}</span></span>`;
  });
}
