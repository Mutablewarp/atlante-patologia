/**
 * Lens context (NAVIGATION_SPEC §3): with `?via=lens:term`, swap the default
 * breadcrumb and prev/next (organ-system order) for the server-rendered
 * <template>s of that lens term. rel=canonical never changes.
 */
const via = new URLSearchParams(location.search).get('via');
if (via) {
  const swap = (slot: string, attr: string) => {
    const tpl = [...document.querySelectorAll<HTMLTemplateElement>(`template[${attr}]`)].find(
      (t) => t.getAttribute(attr) === via,
    );
    const target = document.querySelector<HTMLElement>(`[${slot}]`);
    if (tpl && target) target.replaceChildren(tpl.content.cloneNode(true));
  };
  swap('data-lens-crumb', 'data-via-crumb');
  swap('data-lens-nav', 'data-via-nav');
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
