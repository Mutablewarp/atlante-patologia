/**
 * Glossary popovers ([[g:id]] in bodies). Tap/click, Enter/Space and Escape
 * come from the native Popover API (popovertarget). This adds hover and
 * places the popover next to its term instead of the viewport centre.
 */
const terms = document.querySelectorAll<HTMLButtonElement>('.gloss-term');
let closeTimer: number | undefined;

function place(btn: HTMLButtonElement, pop: HTMLElement) {
  const r = btn.getBoundingClientRect();
  const w = Math.min(pop.offsetWidth, window.innerWidth - 16);
  const left = Math.max(8, Math.min(r.left, window.innerWidth - w - 8));
  const below = r.bottom + 6 + pop.offsetHeight < window.innerHeight;
  pop.style.left = `${left}px`;
  pop.style.top = below ? `${r.bottom + 6}px` : `${Math.max(8, r.top - pop.offsetHeight - 6)}px`;
}

terms.forEach((btn) => {
  const pop = document.getElementById(btn.getAttribute('popovertarget') ?? '');
  if (!pop || !('showPopover' in pop)) return;
  const follow = () => place(btn, pop);
  pop.addEventListener('toggle', (ev) => {
    const isOpen = (ev as ToggleEvent).newState === 'open';
    if (isOpen) place(btn, pop);
    // Popovers are position: fixed; keep them next to the term while the page scrolls.
    window[isOpen ? 'addEventListener' : 'removeEventListener']('scroll', follow);
  });
  let byHover = false;
  const open = () => {
    clearTimeout(closeTimer);
    if (pop.matches(':popover-open')) return;
    pop.showPopover();
    byHover = true;
  };
  // A click right after a hover-open keeps it open instead of toggling it shut.
  btn.addEventListener('click', (ev) => {
    if (byHover && pop.matches(':popover-open')) ev.preventDefault();
    byHover = false;
  });
  const close = () => {
    closeTimer = window.setTimeout(() => pop.matches(':popover-open') && pop.hidePopover(), 250);
  };
  // Hover only for real pointers; touch uses the native tap toggle.
  btn.addEventListener('pointerenter', (ev) => ev.pointerType === 'mouse' && open());
  btn.addEventListener('pointerleave', (ev) => ev.pointerType === 'mouse' && close());
  pop.addEventListener('pointerenter', () => clearTimeout(closeTimer));
  pop.addEventListener('pointerleave', (ev) => ev.pointerType === 'mouse' && close());
});

export {};
