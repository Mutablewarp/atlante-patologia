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
  syncExpandBtn();
}
window.addEventListener('hashchange', openHash);
openHash();

document.querySelector('[data-print]')?.addEventListener('click', () => window.print());

export {};
