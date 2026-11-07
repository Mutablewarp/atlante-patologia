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
  const section = document.getElementById(decodeURIComponent(a.hash.slice(1)))?.closest('section');
  if (section) entryOf.set(section, a);
});
const spied = [...entryOf.keys()];
if (strip && spied.length) {
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const inBand = new Set<Element>();
  let current: HTMLAnchorElement | undefined;
  const markCurrent = (a: HTMLAnchorElement | undefined) => {
    if (a === current) return;
    current?.removeAttribute('aria-current');
    current = a;
    a?.setAttribute('aria-current', 'true');
    // Phone/tablet chip strip: bring the current chip to the middle (the strip scrolls sideways only).
    if (!a || strip.scrollWidth <= strip.clientWidth) return;
    const delta = a.getBoundingClientRect().left - strip.getBoundingClientRect().left - (strip.clientWidth - a.offsetWidth) / 2;
    strip.scrollBy({ left: delta, behavior: reduceMotion.matches ? 'auto' : 'smooth' });
  };
  // The section being read: the last one crossing the top 30% of the viewport. Hidden
  // sections (Quick mode) never intersect; past the last section the last one stays current.
  const spy = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => (e.isIntersecting ? inBand.add(e.target) : inBand.delete(e.target)));
      const reading = spied.filter((s) => inBand.has(s)).at(-1);
      if (reading) markCurrent(entryOf.get(reading));
      else if (spied[0]!.getBoundingClientRect().top > innerHeight * 0.3) markCurrent(undefined);
    },
    { rootMargin: '0px 0px -70% 0px' },
  );
  spied.forEach((s) => spy.observe(s));
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
/** Scroll a chapter index so the current card sits in its middle: scrollTop only, the page never moves. */
const centreCurrent = (tree: HTMLElement) => {
  const cur = tree.querySelector('a[aria-current]');
  if (!cur) return;
  const [t, r] = [tree.getBoundingClientRect(), cur.getBoundingClientRect()];
  tree.scrollTop += r.top - t.top - (tree.clientHeight - r.height) / 2;
};
const chapter = document.querySelector<HTMLDialogElement>('[data-chapter-dialog]');
const chapterBtn = document.querySelector<HTMLButtonElement>('[data-chapter-open]');
if (chapter && chapterBtn) {
  const tree = chapter.querySelector<HTMLElement>('.module-tree')!;
  chapterBtn.addEventListener('click', () => {
    chapter.showModal();
    centreCurrent(tree);
    tree.querySelector<HTMLElement>('a[aria-current]')?.focus({ preventScroll: true });
  });
  // A click on the backdrop closes it, as Esc does; focus goes back to the button.
  chapter.addEventListener('click', (ev) => {
    const r = chapter.getBoundingClientRect();
    if (ev.target === chapter && (ev.clientX < r.left || ev.clientX > r.right || ev.clientY < r.top || ev.clientY > r.bottom)) chapter.close();
  });
  chapter.addEventListener('close', () => chapterBtn.focus());
  // Back from the card picked in it, the page comes out of the browser cache with the dialog closed.
  addEventListener('pagehide', () => chapter.close());
}

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
