/**
 * Entity page behaviour: collapsible sections, expand/collapse all,
 * Quick/Full mode (remembered), open the section targeted by #hash, print.
 */
const root = document.documentElement;
const toggles = [...document.querySelectorAll<HTMLButtonElement>('[data-section-toggle]')];
const bodyOf = (btn: HTMLButtonElement) => document.getElementById(btn.getAttribute('aria-controls') ?? '');

function setOpen(btn: HTMLButtonElement, open: boolean) {
  btn.setAttribute('aria-expanded', String(open));
  const body = bodyOf(btn);
  if (body) body.hidden = !open;
}
toggles.forEach((btn) => btn.addEventListener('click', () => setOpen(btn, btn.getAttribute('aria-expanded') !== 'true')));

const expandBtn = document.querySelector<HTMLButtonElement>('[data-expand-all]');
function syncExpandBtn() {
  if (!expandBtn) return;
  const allOpen = toggles.every((b) => b.getAttribute('aria-expanded') === 'true');
  expandBtn.textContent = (allOpen ? expandBtn.dataset.labelCollapse : expandBtn.dataset.labelExpand) ?? '';
}
expandBtn?.addEventListener('click', () => {
  const allOpen = toggles.every((b) => b.getAttribute('aria-expanded') === 'true');
  toggles.forEach((b) => setOpen(b, !allOpen));
  syncExpandBtn();
});
toggles.forEach((b) => b.addEventListener('click', syncExpandBtn));

// Quick / Full reading mode
const modeBtns = [...document.querySelectorAll<HTMLButtonElement>('[data-mode-btn]')];
function applyMode(mode: 'quick' | 'full') {
  if (mode === 'quick') root.dataset.mode = 'quick';
  else delete root.dataset.mode;
  modeBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.modeBtn === mode)));
  try {
    localStorage.setItem('ap-mode', mode);
  } catch {
    /* preference won't persist */
  }
}
modeBtns.forEach((b) => b.addEventListener('click', () => applyMode(b.dataset.modeBtn === 'quick' ? 'quick' : 'full')));
applyMode(root.dataset.mode === 'quick' ? 'quick' : 'full');

// Deep links (#micro): make sure the target section is visible and open.
function openHash() {
  const id = decodeURIComponent(location.hash.slice(1));
  const section = id ? document.getElementById(id)?.closest<HTMLElement>('.entity-section') : null;
  if (!section) return;
  if (section.dataset.quick === 'false' && root.dataset.mode === 'quick') applyMode('full');
  const btn = section.querySelector<HTMLButtonElement>('[data-section-toggle]');
  if (btn) setOpen(btn, true);
  section.dataset.revealed = '';
  syncExpandBtn();
}
window.addEventListener('hashchange', openHash);
openHash();

document.querySelector('[data-print]')?.addEventListener('click', () => window.print());

// "Try to recall first" (optional, remembered): section bodies stay hidden behind a prompt until revealed.
const recallBtn = document.querySelector<HTMLButtonElement>('[data-recall-toggle]');
function applyRecall(on: boolean) {
  if (on) root.dataset.recall = 'on';
  else delete root.dataset.recall;
  document.querySelectorAll<HTMLElement>('.entity-section[data-revealed]').forEach((s) => delete s.dataset.revealed);
  recallBtn?.setAttribute('aria-pressed', String(on));
  try {
    localStorage.setItem('ap-recall', on ? 'on' : 'off');
  } catch {
    /* preference won't persist */
  }
}
recallBtn?.addEventListener('click', () => applyRecall(root.dataset.recall !== 'on'));
let recallSaved: string | null = null;
try {
  recallSaved = localStorage.getItem('ap-recall');
} catch {
  /* storage unavailable */
}
applyRecall(recallSaved === 'on');
document.querySelectorAll<HTMLButtonElement>('[data-recall-reveal]').forEach((b) =>
  b.addEventListener('click', () => {
    const section = b.closest<HTMLElement>('.entity-section');
    if (!section) return;
    section.dataset.revealed = '';
    const body = section.querySelector<HTMLElement>('.section-body');
    if (body) {
      body.tabIndex = -1;
      body.focus();
    }
  }),
);
openHash();

// Scroll-spy: mark the TOC entry of the section being read.
const tocLinks = new Map(
  [...document.querySelectorAll<HTMLAnchorElement>('.section-toc a[href^="#"]')].map((a) => [a.hash.slice(1), a]),
);
const spySections = [...document.querySelectorAll<HTMLElement>('.entity-section')];
const strip = document.querySelector<HTMLElement>('.section-toc ol');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
const inBand = new Set<Element>();
let currentId: string | undefined;
function markCurrent(id: string | undefined) {
  if (id === currentId) return;
  currentId = id;
  tocLinks.forEach((a, key) => (key === id ? a.setAttribute('aria-current', 'true') : a.removeAttribute('aria-current')));
  // Phone/tablet chip strip: bring the current chip to the middle (the strip scrolls sideways only).
  const a = id ? tocLinks.get(id) : undefined;
  if (!a || !strip || strip.scrollWidth <= strip.clientWidth) return;
  const delta = a.getBoundingClientRect().left - strip.getBoundingClientRect().left - (strip.clientWidth - a.offsetWidth) / 2;
  strip.scrollBy({ left: delta, behavior: reduceMotion.matches ? 'auto' : 'smooth' });
}
// The section being read: the last one crossing the top 30% of the viewport. Hidden
// sections (Quick mode) never intersect; past the last section the last one stays current.
const spy = new IntersectionObserver(
  (entries) => {
    entries.forEach((e) => (e.isIntersecting ? inBand.add(e.target) : inBand.delete(e.target)));
    const current = spySections.filter((s) => inBand.has(s)).at(-1);
    if (current) markCurrent(current.id);
    else if (spySections[0] && spySections[0].getBoundingClientRect().top > innerHeight * 0.3) markCurrent(undefined);
  },
  { rootMargin: '0px 0px -70% 0px' },
);
spySections.forEach((s) => spy.observe(s));

export {};
