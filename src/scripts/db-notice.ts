/**
 * Shows the learner-database notice (components/offline/UpdateNotice.astro)
 * for the states that lib/db.ts reports with `ap:db-state` events, and keeps
 * focus clear of the fixed notices: their height feeds `--notice-h`, which the
 * layout adds to scroll-padding-bottom and to the footer (WCAG 2.4.11).
 */
import type { DbState } from '../lib/db.ts';

const box = document.querySelector<HTMLElement>('[data-db-box]');
const update = document.querySelector<HTMLElement>('[data-update-notice]');
let state: DbState = 'ready';
let dismissed = false;

function render() {
  if (!box) return;
  // A waiting worker's Reload also reloads the older tabs that show its notice (sw-register.ts), which ends the wait.
  const view = state === 'blocked' && update && !update.hidden ? 'blocked-update' : state;
  const wasShown = !box.hidden;
  box.hidden = dismissed || (state !== 'blocked' && state !== 'blocking');
  box.querySelectorAll<HTMLElement>('[data-db-msg]').forEach((el) => (el.hidden = !(el.dataset.dbMsg ?? '').split(' ').includes(view)));
  // The pressed button is gone: never leave focus on <body>.
  if (wasShown && box.hidden && box.contains(document.activeElement)) document.getElementById('main')?.focus({ preventScroll: true });
}

function dismiss() {
  dismissed = true;
  render();
}

/** Escape belongs to an open dialog or popover first. */
function overlayOpen() {
  try {
    return !!document.querySelector('dialog[open], [popover]:popover-open');
  } catch {
    return !!document.querySelector('dialog[open]'); // no :popover-open support
  }
}

if (box) {
  window.addEventListener('ap:db-state', (e) => {
    const next = (e as CustomEvent<DbState>).detail;
    // 'blocking' is final: this tab closed its connection and only a reload brings the data back.
    if (state === 'blocking' || next === state) return;
    state = next;
    dismissed = false;
    render();
  });
  if (update) new MutationObserver(render).observe(update, { attributes: true, attributeFilter: ['hidden'] });
  box.querySelector('[data-db-reload]')?.addEventListener('click', () => location.reload());
  box.querySelectorAll('[data-db-dismiss]').forEach((b) => b.addEventListener('click', dismiss));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !box.hidden && !e.defaultPrevented && !overlayOpen()) dismiss();
  });
}

const notices = document.querySelector<HTMLElement>('[data-notices]');
if (notices) {
  // How far up from the bottom of the viewport the notices reach (0 when none is shown).
  const space = () => {
    const r = notices.getBoundingClientRect();
    document.documentElement.style.setProperty('--notice-h', r.height ? `${Math.ceil(innerHeight - r.top)}px` : '0px');
  };
  new ResizeObserver(space).observe(notices);
  window.addEventListener('resize', space);
}
