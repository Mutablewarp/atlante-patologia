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
}

export {};
