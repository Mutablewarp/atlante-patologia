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
function applyTheme(theme: Theme) {
  if (theme === 'system') delete root.dataset.theme;
  else root.dataset.theme = theme;
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
document.querySelectorAll<HTMLAnchorElement>('[data-set-lang]').forEach((a) =>
  a.addEventListener('click', () => store.set('ap-lang', a.dataset.setLang ?? '')),
);

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

// ── Ctrl/⌘ K: focus the search field (the command palette comes later) ──
const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
document.querySelectorAll('[data-shortcut-hint]').forEach((k) => (k.textContent = isMac ? '⌘ K' : 'Ctrl K'));
document.addEventListener('keydown', (ev) => {
  if (ev.key.toLowerCase() !== 'k' || !(ev.metaKey || ev.ctrlKey)) return;
  ev.preventDefault();
  const field = document.querySelector<HTMLInputElement>('[data-page-search]') ?? document.querySelector<HTMLInputElement>('[data-global-search]');
  if (field && field.offsetParent !== null) field.focus();
  else location.href = (document.querySelector<HTMLAnchorElement>('.nav-item[data-tab="search"]')?.dataset.root) ?? '';
});

export {};
