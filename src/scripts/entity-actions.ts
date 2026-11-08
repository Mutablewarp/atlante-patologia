/**
 * Entity page personal layer: study actions (EntityActions.astro), recently
 * viewed + "resume" position, and reading progress per section. All data goes
 * to IndexedDB; if storage is unavailable the buttons stay inert.
 */
import { fmt } from '../i18n/index.ts';
import { get, getAll, put, putMany, remove, recordRecent } from '../lib/db.ts';
import { emptyFsrs } from '../lib/progress.ts';

const box = document.querySelector<HTMLElement>('[data-entity-actions]');
if (box) void init(box);

async function init(box: HTMLElement) {
  const d = box.dataset;
  const entity = d.id!;
  const module = d.module!;
  const names = { it: d.nameIt!, en: d.nameEn! };
  const cardIds = JSON.parse(d.cards ?? '[]') as string[];
  const live = box.querySelector<HTMLElement>('[data-live]')!;
  const say = (msg: string) => {
    live.textContent = '';
    requestAnimationFrame(() => (live.textContent = msg));
  };
  const btn = (act: string) => box.querySelector<HTMLButtonElement>(`[data-act="${act}"]`);
  // The bookmark also has a copy in the toolbar row (EntityPinned.astro): every copy shares one state.
  const head = box.closest('.entity-head') ?? box;
  const copies = (act: string) => [...head.querySelectorAll<HTMLButtonElement>(`[data-act="${act}"]`)];

  try {
    await recordRecent({ id: entity, names, module });
  } catch {
    return; // no IndexedDB: nothing below can work
  }

  // ── Add to review ───────────────────────────────────────────────────
  const reviewBtn = btn('review');
  const syncReview = async () => {
    if (!reviewBtn) return;
    const have = new Set((await getAll('cards')).map((c) => c.id));
    const all = cardIds.every((id) => have.has(id));
    reviewBtn.setAttribute('aria-pressed', String(all));
    if (all) reviewBtn.textContent = fmt(d.labelAdded!, { n: cardIds.length });
  };
  reviewBtn?.addEventListener('click', async () => {
    const have = new Set((await getAll('cards')).map((c) => c.id));
    const now = Date.now();
    const fresh = cardIds.filter((id) => !have.has(id)).map((id) => ({ id, entity, module, fsrs: emptyFsrs(now), added: now, updated: now }));
    if (fresh.length) await putMany('cards', fresh);
    say(fmt(d.liveAdded!, { n: fresh.length }));
    await syncReview();
  });
  await syncReview();

  // ── Toggles: bookmark, error log ────────────────────────────────────
  const toggle = async (act: 'bookmark' | 'error') => {
    const bs = copies(act);
    const store = act === 'bookmark' ? 'bookmarks' : 'errors';
    const id = act === 'bookmark' ? entity : `entity:${entity}`;
    const on = bs[0]?.getAttribute('aria-pressed') === 'true';
    if (on) await remove(store, id);
    else if (act === 'bookmark') await put('bookmarks', { id, updated: Date.now() });
    else await put('errors', { id, entity, updated: Date.now() });
    bs.forEach((b) => b.setAttribute('aria-pressed', String(!on)));
  };
  const saved = { bookmark: !!(await get('bookmarks', entity)), error: !!(await get('errors', `entity:${entity}`)) };
  for (const act of ['bookmark', 'error'] as const)
    for (const b of copies(act)) {
      b.setAttribute('aria-pressed', String(saved[act]));
      b.addEventListener('click', () => void toggle(act));
    }

  // ── Note ────────────────────────────────────────────────────────────
  const noteField = box.querySelector<HTMLTextAreaElement>('[data-note]')!;
  noteField.value = (await get('notes', entity))?.text ?? '';
  btn('note')?.addEventListener('click', async () => {
    const text = noteField.value.trim();
    if (text) await put('notes', { id: entity, text, updated: Date.now() });
    else await remove('notes', entity);
    say(d.liveSaved!);
  });

  // ── Highlight: save the selected text of one section ────────────────
  const hl = btn('highlight')!;
  let pending: { section: string; text: string } | null = null;
  document.addEventListener('selectionchange', () => {
    const sel = document.getSelection();
    const text = sel?.toString().trim() ?? '';
    const node = sel?.anchorNode;
    const section = (node instanceof Element ? node : node?.parentElement)?.closest<HTMLElement>('.entity-section');
    pending = text && section ? { section: section.id, text: text.slice(0, 2000) } : null;
    hl.disabled = !pending;
  });
  hl.addEventListener('mousedown', (e) => e.preventDefault()); // keep the selection when clicking
  hl.addEventListener('click', async () => {
    if (!pending) return;
    const now = Date.now();
    await put('highlights', { id: `${entity}:${now}`, entity, section: pending.section, text: pending.text, updated: now });
    say(d.liveHighlight!);
  });

  for (const el of [box, ...head.querySelectorAll<HTMLElement>('[data-entity-pinned]')]) el.dataset.ready = '';
  trackReading(entity, names, module);
}

/** Section read = its end scrolled into view while open. Resume = the section at the top of the viewport. */
function trackReading(entity: string, names: { it: string; en: string }, module: string) {
  const sections = [...document.querySelectorAll<HTMLElement>('.entity-section')];
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      const section = (e.target as HTMLElement).dataset.readSentinel!;
      io.unobserve(e.target);
      const now = Date.now();
      void put('readProgress', { id: `${entity}#${section}`, entity, section, at: now, updated: now }).catch(() => {});
    }
  });
  for (const s of sections) {
    const body = s.querySelector('.section-body') ?? s;
    const mark = document.createElement('span');
    mark.dataset.readSentinel = s.id;
    mark.setAttribute('aria-hidden', 'true');
    body.append(mark);
    io.observe(mark);
  }

  let current = '';
  let timer = 0;
  const onScroll = () => {
    const line = window.innerHeight * 0.35;
    const here = sections.filter((s) => s.getBoundingClientRect().top < line).at(-1)?.id ?? '';
    if (here === current) return;
    current = here;
    clearTimeout(timer);
    timer = window.setTimeout(() => void recordRecent({ id: entity, names, module, ...(current ? { section: current } : {}) }).catch(() => {}), 1500);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
}

export {};
