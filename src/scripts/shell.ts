/**
 * App-shell behaviour shared by every page (progressive enhancement: the site
 * works without it). Storage access is wrapped: private modes may throw.
 */
const root = document.documentElement;
const store = {
  get(k: string, s: Storage = localStorage) {
    try {
      return s.getItem(k);
    } catch {
      return null;
    }
  },
  set(k: string, v: string, s: Storage = localStorage) {
    try {
      s.setItem(k, v);
    } catch {
      /* storage unavailable: preference just won't persist */
    }
  },
};

/** A scroller lists in data-fade the edges ("start", "end") that hide content; the CSS fades those edges. It scrolls
    sideways (the chip strip) or up and down (an index, the side list): the same list does both across 1024 px. Also
    watched: its children, whose size changes when content hides or opens (Quick mode, a chapter folded). */
function edgeFade(el: HTMLElement) {
  const update = () => {
    const across = scrolls(el, 'x');
    const [pos, size, view] = across ? [el.scrollLeft, el.scrollWidth, el.clientWidth] : [el.scrollTop, el.scrollHeight, el.clientHeight];
    const fade = `${pos > 1 ? 'start' : ''} ${pos + view < size - 1 ? 'end' : ''}`.trim();
    if (fade) el.dataset.fade = fade;
    else delete el.dataset.fade;
  };
  el.addEventListener('scroll', update, { passive: true });
  const watch = new ResizeObserver(update);
  for (const box of [el, ...el.children]) watch.observe(box);
}

/** Does `el` scroll on this axis: overflow set to scroll there, and content beyond its box? (A hidden overflow can
    still be scrolled by script, which would shift a list sideways out of view.) */
function scrolls(el: HTMLElement, axis: 'x' | 'y') {
  const overflow = getComputedStyle(el)[axis === 'x' ? 'overflowX' : 'overflowY'];
  const [size, view] = axis === 'x' ? [el.scrollWidth, el.clientWidth] : [el.scrollHeight, el.clientHeight];
  return (overflow === 'auto' || overflow === 'scroll') && size - view > 1;
}

/** Scroll `box` so `el` sits in its middle, on the axis `box` scrolls on: scrollLeft or scrollTop only, the page never
    moves (scrollIntoView would scroll it too). */
function centreIn(box: HTMLElement, el: Element, behavior: ScrollBehavior = 'auto') {
  const [b, r] = [box.getBoundingClientRect(), el.getBoundingClientRect()];
  box.scrollBy({
    left: scrolls(box, 'x') ? r.left - b.left - (box.clientWidth - r.width) / 2 : 0,
    top: scrolls(box, 'y') ? r.top - b.top - (box.clientHeight - r.height) / 2 : 0,
    behavior,
  });
}

// ── Theme: system → light → dark ────────────────────────────────────────
const THEMES = ['system', 'light', 'dark'] as const;
type Theme = (typeof THEMES)[number];
const themeBtn = document.querySelector<HTMLButtonElement>('[data-theme-toggle]');
// Browser chrome colour (theme-color) follows a forced theme, not only the system one.
const themeMetas = [...document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')].map((m) => [m, m.content] as const);
function applyTheme(theme: Theme) {
  if (theme === 'system') delete root.dataset.theme;
  else root.dataset.theme = theme;
  // A forced theme paints both metas with its colour; 'system' restores each one.
  const forced = themeMetas.find(([m]) => m.media.includes(`(prefers-color-scheme: ${theme})`))?.[1];
  themeMetas.forEach(([m, original]) => (m.content = forced ?? original));
  if (!themeBtn) return;
  const labels = JSON.parse(themeBtn.dataset.labels ?? '{}') as Record<Theme, string>;
  themeBtn.setAttribute('aria-label', (themeBtn.dataset.template ?? '{mode}').replace('{mode}', labels[theme]));
  themeBtn.title = labels[theme];
}
const savedTheme = store.get('ap-theme');
applyTheme(savedTheme === 'light' || savedTheme === 'dark' ? savedTheme : 'system');
themeBtn?.addEventListener('click', () => {
  const current = (root.dataset.theme as Theme | undefined) ?? 'system';
  const next = THEMES[(THEMES.indexOf(current) + 1) % THEMES.length]!;
  store.set('ap-theme', next);
  applyTheme(next);
});

// ── Reading size A-/A+: root class (applied before paint by BaseLayout) ─
const SIZES = ['s', 'm', 'l', 'xl'] as const;
type Size = (typeof SIZES)[number];
const sizeGroups = document.querySelectorAll<HTMLElement>('[data-text-size]');
function applySize(size: Size, announce = false) {
  SIZES.forEach((s) => root.classList.toggle(`text-${s}`, s === size && s !== 'm'));
  const i = SIZES.indexOf(size);
  sizeGroups.forEach((g) => {
    g.querySelectorAll<HTMLButtonElement>('[data-text-step]').forEach((b) => {
      const end = b.dataset.textStep === '-1' ? i === 0 : i === SIZES.length - 1;
      // aria-disabled, not disabled: the focused button keeps focus at the end of the range.
      if (end) b.setAttribute('aria-disabled', 'true');
      else b.removeAttribute('aria-disabled');
    });
    const status = g.querySelector('[data-text-size-status]');
    if (status && announce) status.textContent = (g.dataset.status ?? '').replace('{n}', String(i + 1)).replace('{total}', String(SIZES.length));
  });
}
const savedSize = store.get('ap-text');
applySize((SIZES as readonly string[]).includes(savedSize ?? '') ? (savedSize as Size) : 'm');
sizeGroups.forEach((g) =>
  g.addEventListener('click', (ev) => {
    const btn = (ev.target as Element).closest<HTMLButtonElement>('[data-text-step]');
    if (!btn || btn.getAttribute('aria-disabled') === 'true') return;
    const current = SIZES.find((s) => root.classList.contains(`text-${s}`)) ?? 'm';
    const next = SIZES[Math.min(SIZES.length - 1, Math.max(0, SIZES.indexOf(current) + Number(btn.dataset.textStep)))]!;
    store.set('ap-text', next);
    applySize(next, true);
  }),
);

// ── Reading progress (entity and pattern pages): transform only, no layout ─
const progress = document.querySelector<HTMLElement>('[data-read-progress]');
const article = progress?.closest<HTMLElement>('article');
if (progress && article) {
  let queued = false;
  const update = () => {
    queued = false;
    const r = article.getBoundingClientRect();
    const p = Math.min(1, Math.max(0, -r.top / Math.max(1, r.height - innerHeight)));
    progress.style.transform = `scaleX(${p})`;
  };
  const queue = () => {
    if (!queued) requestAnimationFrame(update);
    queued = true;
  };
  addEventListener('scroll', queue, { passive: true });
  addEventListener('resize', queue, { passive: true });
  update();
}

// ── Section spy (entity and pattern pages): mark the contents entry being read ─
const strip = document.querySelector<HTMLElement>('.section-toc ol');
// An entry's section: the element its #hash names or, for a heading, the <section> around it.
const entryOf = new Map<Element, HTMLAnchorElement>();
strip?.querySelectorAll<HTMLAnchorElement>('a[href^="#"]').forEach((a) => {
  const target = document.getElementById(decodeURIComponent(a.hash.slice(1)));
  const section = target?.closest('section') ?? target;
  if (section) entryOf.set(section, a);
});
const spied = [...entryOf.keys()];
// The chip strip (< 1024 px) scrolls sideways; the side list (>= 1024 px) up and down when taller than the screen.
if (strip) edgeFade(strip);
if (strip && spied.length) {
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let current: HTMLAnchorElement | undefined;
  const markCurrent = (a: HTMLAnchorElement | undefined) => {
    if (a === current) return;
    current?.removeAttribute('aria-current');
    current = a;
    a?.setAttribute('aria-current', 'true');
    // The current entry comes to the middle of the list, on the axis the list scrolls on; never while a keyboard
    // user is in the list, where it pushed the focused entry out of view (SC 2.4.11).
    if (a && !strip.querySelector(':focus-visible')) centreIn(strip, a, reduceMotion.matches ? 'auto' : 'smooth');
  };
  // The section being read is the one under a reading line just below the sticky bars: 8 px under the place where
  // an anchor puts its heading (scroll-padding-top). A short section no longer loses to the next one, as it did in
  // a band of the top 30 % of the screen. Hidden sections (Quick mode) and hidden entries (the last two on phones)
  // are skipped, and between two sections the current one stays. At the end of the page, which the last sections
  // may not scroll up to the line, a tapped section on screen stays current, else the last one on screen is.
  const shown = (el: Element) => el.getClientRects().length > 0;
  const sectionOf = new Map([...entryOf].map(([s, a]) => [a, s]));
  let tapped: Element | undefined;
  const read = () => {
    const line = parseFloat(getComputedStyle(root).scrollPaddingTop) + 8;
    const live = spied.filter((s) => shown(s) && shown(entryOf.get(s)!));
    const boxes = live.map((s) => s.getBoundingClientRect());
    let i = boxes.findIndex((r) => r.top <= line && r.bottom > line);
    if (innerHeight + scrollY >= root.scrollHeight - 2) {
      const t = tapped ? live.indexOf(tapped) : -1;
      i = t >= 0 && boxes[t]!.top < innerHeight ? t : boxes.map((r) => r.top < innerHeight).lastIndexOf(true);
    } else tapped = undefined;
    if (i >= 0) markCurrent(entryOf.get(live[i]!));
    else if (!boxes[0] || boxes[0].top > line) markCurrent(undefined);
  };
  // A tap on an entry marks it at once; while the page scrolls there the line passes other sections, so the spy
  // waits until the scrolling settles (150 ms without a scroll event) and then reads the line again.
  let held = false;
  let settle: ReturnType<typeof setTimeout> | undefined;
  const settleThenRead = () => {
    clearTimeout(settle);
    settle = setTimeout(() => {
      held = false;
      read();
    }, 150);
  };
  // A keyboard-focused entry comes to the middle of the list instead, whole (the browser only scrolls it to the edge).
  // Not on a click or a tap, which focuses the entry too: the list would move under the pointer before it is let go.
  strip.addEventListener('focusin', (ev) => {
    const el = ev.target as Element;
    if (el.matches(':focus-visible')) centreIn(strip, el);
  });
  strip.addEventListener('click', (ev) => {
    const a = (ev.target as Element).closest<HTMLAnchorElement>('a[href^="#"]');
    if (!a || !sectionOf.has(a)) return;
    markCurrent(a);
    tapped = sectionOf.get(a);
    held = true;
    settleThenRead();
  });
  let queued = false;
  const queue = () => {
    if (held) return settleThenRead(); // still scrolling to the tapped entry's section
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      read();
    });
  };
  addEventListener('scroll', queue, { passive: true });
  // Sections that open, close or hide (Quick mode, a section folded) and a new width move the line's section.
  new ResizeObserver(queue).observe(strip.closest('.entity-layout') ?? document.body);
}

// ── Phones: reading down, the chip strip slides up behind the top bar; reading up, it comes back ─
// Only a root attribute changes; entity.css moves the strip with a transform, so the layout never shifts.
const chipStrip = document.querySelector<HTMLElement>('.section-toc');
const chipLayout = chipStrip?.closest<HTMLElement>('.entity-layout');
const topBar = document.querySelector<HTMLElement>('.topbar');
if (chipStrip && chipLayout && topBar) {
  const phone = matchMedia('(max-width: 599px)');
  const STEP = 8; // px of scroll that count as a direction, not as jitter
  let lastY = scrollY;
  let queued = false;
  const update = () => {
    queued = false;
    const y = scrollY;
    // Stuck under the top bar only once its layout has scrolled under it; before that the strip is in the page flow.
    if (!phone.matches || chipLayout.getBoundingClientRect().top >= topBar.getBoundingClientRect().bottom) {
      delete root.dataset.chips;
      lastY = y;
      return;
    }
    if (Math.abs(y - lastY) < STEP) return;
    if (y > lastY) root.dataset.chips = 'away';
    else delete root.dataset.chips;
    lastY = y;
  };
  addEventListener(
    'scroll',
    () => {
      if (!queued) requestAnimationFrame(update);
      queued = true;
    },
    { passive: true },
  );
  phone.addEventListener('change', update);
}

// ── Chapter index (entity pages): the "Chapter" dialog opens on the current card ─
/** Scroll a chapter index so the current card sits in its middle. */
const centreCurrent = (tree: HTMLElement) => {
  const cur = tree.querySelector('a[aria-current]');
  if (cur) centreIn(tree, cur);
};
const chapter = document.querySelector<HTMLDialogElement>('[data-chapter-dialog]');
const chapterBtn = document.querySelector<HTMLButtonElement>('[data-chapter-open]');
const sideTree = document.querySelector<HTMLElement>('.primary-nav .module-tree');
if (chapter && chapterBtn && sideTree) {
  // The page carries the index once (D069): the sidebar's copy moves into the dialog while it is open, and back after.
  const [home, after] = [sideTree.parentElement!, sideTree.nextSibling];
  const putBack = () => home.insertBefore(sideTree, after);
  chapterBtn.addEventListener('click', () => {
    chapter.append(sideTree);
    chapter.showModal();
    centreCurrent(sideTree);
    sideTree.querySelector<HTMLElement>('a[aria-current]')?.focus({ preventScroll: true });
  });
  // A click on the backdrop closes it, as Esc does; focus goes back to the button.
  chapter.addEventListener('click', (ev) => {
    const r = chapter.getBoundingClientRect();
    if (ev.target === chapter && (ev.clientX < r.left || ev.clientX > r.right || ev.clientY < r.top || ev.clientY > r.bottom)) chapter.close();
  });
  chapter.addEventListener('close', () => {
    putBack();
    chapterBtn.focus();
  });
  // Back from the card picked in it, the page comes out of the browser cache with the dialog closed.
  addEventListener('pagehide', () => {
    chapter.close();
    putBack();
  });
}
// The sidebar copy (>= 1024 px) opens on the current card each time it appears (on load, when the sidebar is
// expanded, when an iPad turns to landscape) and while its width changes (the sidebar opens with a transition, and
// the cards wrap differently); a change of height alone (the browser's toolbars) leaves the reader's scroll alone.
if (sideTree) {
  let width = 0;
  new ResizeObserver(() => {
    const shown = sideTree.clientHeight > 0;
    if (shown && sideTree.clientWidth !== width) centreCurrent(sideTree);
    width = shown ? sideTree.clientWidth : 0;
  }).observe(sideTree);
}
document.querySelectorAll<HTMLElement>('.module-tree').forEach((tree) => edgeFade(tree));

// ── Sidebar collapse (desktop) ──────────────────────────────────────────
const sideBtn = document.querySelector<HTMLButtonElement>('[data-sidebar-toggle]');
function syncSidebar() {
  if (!sideBtn) return;
  const collapsed = root.dataset.sidebar === 'collapsed';
  sideBtn.setAttribute('aria-pressed', String(collapsed));
  sideBtn.setAttribute('aria-label', (collapsed ? sideBtn.dataset.labelExpand : sideBtn.dataset.labelCollapse) ?? '');
}
syncSidebar();
sideBtn?.addEventListener('click', () => {
  if (root.dataset.sidebar === 'collapsed') delete root.dataset.sidebar;
  else root.dataset.sidebar = 'collapsed';
  store.set('ap-sidebar', root.dataset.sidebar ?? 'expanded');
  syncSidebar();
});

// ── First-launch disclaimer ─────────────────────────────────────────────
document.querySelector('[data-dismiss-notice]')?.addEventListener('click', () => {
  store.set('ap-disclaimer', '1');
  root.dataset.disclaimerAck = '';
  const h1 = document.querySelector<HTMLElement>('main h1');
  if (h1) {
    h1.tabIndex = -1;
    h1.focus();
  }
});

// ── Language: remember an explicit choice (used by the root entry page) ─
// and carry ?query and #hash over (search query, section anchor). The search
// page rewrites ?q with replaceState, so the href is refreshed on every use.
const langLinks = document.querySelectorAll<HTMLAnchorElement>('[data-set-lang]');
function keepState() {
  langLinks.forEach((a) => {
    if (a.dataset.keepState === undefined) return;
    const target = new URL(a.href);
    target.search = location.search;
    target.hash = location.hash;
    a.href = target.href;
  });
}
keepState();
addEventListener('hashchange', keepState);
langLinks.forEach((a) => {
  a.addEventListener('click', () => {
    keepState();
    store.set('ap-lang', a.dataset.setLang ?? '');
  });
  a.addEventListener('auxclick', keepState);
  a.addEventListener('focus', keepState);
});

// ── Per-tab back stack (D020): last URL per tab in sessionStorage ───────
const lang = root.lang;
const currentTab = document.body.dataset.tab;
const here = location.pathname + location.search + location.hash;
const langRoot = document.querySelector<HTMLAnchorElement>('.nav-item[data-tab="home"]')?.dataset.root;
if (currentTab) store.set(`ap-tab:${lang}:${currentTab}`, here, sessionStorage);
document.querySelectorAll<HTMLAnchorElement>('.nav-item[data-tab]').forEach((a) =>
  a.addEventListener('click', (ev) => {
    if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey || ev.button !== 0) return;
    const tab = a.dataset.tab!;
    const target =
      tab === currentTab ? a.dataset.root! : (store.get(`ap-tab:${lang}:${tab}`, sessionStorage) ?? a.dataset.root!);
    // Only follow stored URLs inside this site and language.
    if (!langRoot || !target.startsWith(langRoot)) return;
    ev.preventDefault();
    location.href = target;
  }),
);

// ── Ctrl/⌘ K: command palette (lazy-loaded); falls back to the search field ──
const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
document.querySelectorAll('[data-shortcut-hint]').forEach((k) => (k.textContent = isMac ? '⌘ K' : 'Ctrl K'));
const paletteBtn = document.querySelector<HTMLButtonElement>('[data-palette-open]');
const openPalette = () =>
  import('./palette.ts')
    .then((m) => m.openPalette(paletteBtn!))
    .catch(() => (location.href = (JSON.parse(paletteBtn!.dataset.palette!) as { search: string }).search));
paletteBtn?.addEventListener('click', () => void openPalette());
document.addEventListener('keydown', (ev) => {
  if (ev.key.toLowerCase() !== 'k' || !(ev.metaKey || ev.ctrlKey)) return;
  ev.preventDefault();
  if (paletteBtn) {
    void openPalette();
    return;
  }
  const field = document.querySelector<HTMLInputElement>('[data-page-search]') ?? document.querySelector<HTMLInputElement>('[data-global-search]');
  if (field && field.offsetParent !== null) field.focus();
  else location.href = (document.querySelector<HTMLAnchorElement>('.nav-item[data-tab="search"]')?.dataset.root) ?? '';
});

export {};
