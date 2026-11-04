/**
 * Shows the learner-database notice (components/offline/UpdateNotice.astro)
 * for the states that lib/db.ts reports with `ap:db-state` events.
 */
import type { DbState } from '../lib/db.ts';

const box = document.querySelector<HTMLElement>('[data-db-notice]');
if (box) {
  window.addEventListener('ap:db-state', (e) => {
    const state = (e as CustomEvent<DbState>).detail;
    box.hidden = state === 'ready';
    box.querySelectorAll<HTMLElement>('[data-db-msg]').forEach((el) => (el.hidden = el.dataset.dbMsg !== state));
  });
  box.querySelector('[data-db-reload]')?.addEventListener('click', () => location.reload());
}
