/**
 * <ap-body>: the stage of the body page (docs/BODY_SPEC.md §1, §5, §6). Poster, canvas and buttons come as static
 * HTML (components/body/BodyViewer.astro); the tree of systems and organs is the data: the element reads it from the
 * DOM and needs no second source: `section[data-system]` holds elements with `data-organ`, each with a
 * `[data-organ-link]` (its name) and a `.count`; the body page and the home page both follow it. Selection goes through location.hash only. The 3D part (body-3d.ts, three.js) is
 * a dynamic import started by the load rule: after load and idle with a mouse from 48rem, a click below that or on a
 * touch screen, never with save-data, on a slow network or after "turn 3D off". If anything fails, the poster, the
 * tree and the chips stay.
 */
import { parseHash, step, toHash, type BodyManifest, type BodyState } from '../lib/body-view.ts';
import type { Colors, Controller } from './body-3d.ts';

const STORE_KEY = 'ap-body-3d';
const WIDE = '(min-width: 48rem)';
/** By itself only with a mouse: touch screens are phones and tablets, on a mobile network and a weaker GPU. */
const AUTO = '(min-width: 48rem) and (hover: hover) and (pointer: fine)';
const COLOR_VARS = { eosin: '--eosin', hema: '--hema', ink: '--ink', surface2: '--surface-2' } as const;
const KEYS: Record<string, 'left' | 'right' | 'up' | 'down' | 'in' | 'out' | 'reset'> = {
  ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', '+': 'in', '=': 'in', '-': 'out', '0': 'reset',
};
type Act = Parameters<Controller['act']>[0];
type Connection = { saveData?: boolean; effectiveType?: string };

const store = {
  get(): string | null {
    try {
      return localStorage.getItem(STORE_KEY);
    } catch {
      return null;
    }
  },
  set(value: string | null) {
    try {
      if (value === null) localStorage.removeItem(STORE_KEY);
      else localStorage.setItem(STORE_KEY, value);
    } catch {
      /* private mode: the choice just does not persist */
    }
  },
};

/** An organ in the tree. Always under a system section: the host element reflects `data-organ` too and must not match. */
const ORGAN = 'section[data-system] [data-organ]';
const flag = (el: Element, on: boolean) => (on ? el.setAttribute('aria-current', 'true') : el.removeAttribute('aria-current'));

class ApBody extends HTMLElement {
  private manifest: BodyManifest = { organs: {} };
  private ctrl?: Controller;
  private starting = false;
  /** undefined: nothing shown yet, so the whole body (null) still loads its systems. */
  private shownSystem: string | null | undefined;
  private state: BodyState = { system: null, organ: null };
  /** The learner chose a system or an organ: only then do the other sections hide (a start on its own shifts nothing). */
  private interacted = false;
  /** A selection made by a control, not by the browser's own jump to a fragment: only then does the viewer scroll the organ into view. */
  private scrollNext = false;
  private queue: Promise<void> = Promise.resolve();
  private probe?: HTMLElement;
  private abort?: AbortController;
  private said = 0;

  connectedCallback() {
    this.abort?.abort();
    const { signal } = (this.abort = new AbortController());
    this.manifest = this.readTree();
    this.$('[data-load]')?.addEventListener('click', () => void this.start(true), { signal });
    this.$('[data-off]')?.addEventListener('click', () => this.turnOff(), { signal });
    this.querySelectorAll<HTMLElement>('[data-poster]').forEach((p) => p.addEventListener('click', () => void this.start(true), { signal }));
    this.querySelectorAll<HTMLButtonElement>('[data-act]').forEach((b) => b.addEventListener('click', () => this.act(b.dataset.act!), { signal }));
    this.$('[data-stage]')?.addEventListener('keydown', (ev) => this.onKey(ev as KeyboardEvent), { signal });
    this.addEventListener('click', (ev) => this.onLink(ev), { signal });
    // Below 48rem the selected organ's section is a bottom sheet: Esc anywhere inside it closes it.
    this.addEventListener(
      'keydown',
      (ev) => {
        const sheet = (ev.target as HTMLElement).closest?.('section[data-organ]');
        if (ev.key === 'Escape' && sheet && this.sheetOpen(sheet)) {
          ev.preventDefault();
          this.closeSheet();
        }
      },
      { signal },
    );
    addEventListener(
      'hashchange',
      () => {
        this.interacted = true;
        this.scrollNext = true; // sections may hide and shorten the page under a scroll position the browser has just set
        this.sync();
      },
      { signal },
    );
    const theme = new MutationObserver(() => this.recolor());
    theme.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    signal.addEventListener('abort', () => theme.disconnect());
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => this.recolor(), { signal });
    this.sync();
    if (this.autoStart()) {
      const idle = () => {
        if ('requestIdleCallback' in window) requestIdleCallback(() => void this.start(false));
        else setTimeout(() => void this.start(false), 200);
      };
      // After load: the poster is the likely largest paint and the 3D chunk must not compete with it.
      if (document.readyState === 'complete') idle();
      else addEventListener('load', idle, { once: true, signal });
    }
  }

  disconnectedCallback() {
    this.abort?.abort();
    this.stop();
  }

  private $ = (s: string) => this.querySelector<HTMLElement>(s);

  /** Status line, role=status. The same words again are not announced, so clear first and write on the next frame. */
  private say(text: string) {
    const s = this.$('[data-status]');
    if (!s) return;
    const mine = ++this.said;
    if (s.textContent !== text) {
      s.textContent = text;
      return;
    }
    s.textContent = '';
    requestAnimationFrame(() => {
      if (mine === this.said) s.textContent = text;
    });
  }

  /** The tree is the data: system, organ, and the (empty) `of`/`inside` that parseHash, toHash and step do not use. */
  private readTree(): BodyManifest {
    const organs: BodyManifest['organs'] = {};
    this.querySelectorAll<HTMLElement>(ORGAN).forEach((o) => {
      const system = o.closest<HTMLElement>('section[data-system]')!.dataset.system!;
      organs[o.dataset.organ!] = { system, kind: 'none', of: [], inside: null };
    });
    return { organs };
  }

  private published(): string[] {
    return [...this.querySelectorAll<HTMLElement>(ORGAN)].filter((o) => o.querySelector('.body-cards li') || Number(o.dataset.count) > 0).map((o) => o.dataset.organ!);
  }

  private organName(id: string): string {
    return this.querySelector(`section[data-system] [data-organ="${CSS.escape(id)}"] [data-organ-link]`)?.textContent?.trim() ?? id;
  }

  private systemName(id: string): string {
    const h = this.querySelector(`section[data-system="${CSS.escape(id)}"] > :is(h2, h3)`)?.cloneNode(true) as HTMLElement | undefined;
    h?.querySelector('.count')?.remove();
    return h?.textContent?.trim() ?? id;
  }

  private autoStart(): boolean {
    const c = (navigator as Navigator & { connection?: Connection }).connection;
    const slow = ['slow-2g', '2g', '3g'].includes(c?.effectiveType ?? '');
    return matchMedia(AUTO).matches && !c?.saveData && !slow && store.get() !== 'off';
  }

  private sync() {
    // Another fragment (the skip link, a footnote) is not a selection: leave the view as it is.
    if (location.hash && !/^#(?:sys|organ)-/.test(location.hash)) return;
    const next = parseHash(location.hash, this.manifest);
    this.state = next;
    for (const key of ['system', 'organ'] as const) {
      if (next[key]) this.dataset[key] = next[key]!;
      else delete this.dataset[key];
    }
    this.mark();
    this.centreChip();
    this.stageIntoView();
    this.sections();
    this.reveal(next);
    const run = this.queue.then(() => this.apply(next));
    this.queue = run.catch((err) => console.error(err));
  }

  /**
   * While the viewer runs, a chip or an organ link selects through setHash instead of the browser's own jump to the
   * fragment: the jump scrolls to a section that the sheet or the other sections are about to move, and fights the
   * scrolling the viewer does itself. A click with a modifier (a new tab) and every click without the viewer stay native.
   */
  private onLink(ev: MouseEvent) {
    if (!this.hasAttribute('data-on') || ev.defaultPrevented || ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
    const a = (ev.target as Element).closest<HTMLAnchorElement>('a[href*="#sys-"], a[href*="#organ-"]');
    if (!a || !this.contains(a) || new URL(a.href).pathname !== location.pathname) return;
    const next = parseHash(new URL(a.href).hash, this.manifest);
    if (!next.system) return;
    ev.preventDefault();
    this.setHash(next);
  }

  /**
   * From 48rem the panel sits beside the stage: after a selection made by a control or a hash change, bring the system or
   * the organ into view, where the browser's own jump to a fragment would have. Instant: the page is tens of thousands of
   * pixels long and a smooth scroll across it takes seconds. Not for the first load on a deep link: the browser did that.
   */
  private reveal(state: BodyState) {
    const go = this.scrollNext;
    this.scrollNext = false;
    if (!go || !matchMedia(WIDE).matches) return;
    const target = state.organ ? document.getElementById(`organ-${state.organ}`) : state.system ? this.querySelector(`:scope > section[data-system="${CSS.escape(state.system)}"]`) : null;
    target?.scrollIntoView({ block: state.organ ? 'nearest' : 'start', behavior: 'instant' });
  }

  /** Below 48rem an organ opens a sheet over the lower half of the screen: the stage must stay in view above it. */
  private stageIntoView() {
    if (this.state.organ && this.hasAttribute('data-on') && !matchMedia(WIDE).matches) this.$('[data-stage]')?.scrollIntoView({ block: 'start', behavior: 'instant' });
  }

  /** The chip of the selected system scrolls to the middle of its row. Only the row moves: scrollIntoView would also move the page. */
  private centreChip() {
    const chip = this.querySelector<HTMLElement>('.body-systems a[aria-current]');
    const row = chip?.closest<HTMLElement>('.body-systems');
    if (!chip || !row) return;
    const left = chip.getBoundingClientRect().left - row.getBoundingClientRect().left + row.scrollLeft - (row.clientWidth - chip.offsetWidth) / 2;
    row.scrollTo({ left, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }

  /** aria-current on the chip of the selected system and on the link of the selected organ. */
  private mark() {
    const { system, organ } = this.state;
    this.querySelectorAll<HTMLElement>('.body-systems a[data-system]').forEach((a) => flag(a, a.dataset.system === system));
    this.querySelectorAll<HTMLElement>(ORGAN).forEach((o) => {
      const link = o.querySelector('[data-organ-link]');
      if (link) flag(link, o.dataset.organ === organ);
    });
  }

  private async apply(state: BodyState) {
    const c = this.ctrl;
    if (!c || state !== this.state) return;
    if (state.system !== this.shownSystem) {
      this.shownSystem = state.system;
      try {
        await c.showSystem(state.system);
      } catch (err) {
        this.shownSystem = undefined; // the next selection tries again
        if (this.ctrl === c) this.say(this.dataset.tError!);
        throw err;
      }
    }
    if (this.ctrl !== c || state !== this.state) return; // turned off, or another selection took over, while loading
    c.select(state.organ);
    this.say(this.message(state));
  }

  private message(state: BodyState): string {
    if (state.organ) {
      const section = this.querySelector(`section[data-system] [data-organ="${CSS.escape(state.organ)}"]`);
      const name = this.organName(state.organ);
      if (section?.getAttribute('data-kind') === 'none') return this.dataset.tNoModel!.replace('{organ}', name);
      const n = section?.querySelector('.count')?.textContent?.trim() ?? '';
      return this.dataset.tOrgan!.replace('{organ}', name).replace('{n}', n);
    }
    if (state.system) return this.dataset.tSystem!.replace('{system}', this.systemName(state.system));
    return this.dataset.tWhole!;
  }

  /** With the viewer running and a system chosen by the learner only that system shows; otherwise every section stays
   *  visible, so the viewer starting by itself, or on a deep link, shifts nothing. */
  private sections() {
    const only = this.hasAttribute('data-on') && this.interacted ? this.state.system : null;
    this.querySelectorAll<HTMLElement>(':scope > section[data-system]').forEach((s) => (s.hidden = only !== null && s.dataset.system !== only));
  }

  /** The hash stays the one source of truth, but pushState does not scroll the page away from the stage; Back still fires hashchange. */
  private setHash(state: BodyState) {
    this.interacted = true;
    this.scrollNext = true;
    const next = toHash(state);
    if (next === location.hash) return; // a tap on nothing in the whole-body view changes nothing: no empty history entry
    history.pushState(null, '', next || location.pathname + location.search);
    this.sync();
  }

  /** A tap on the canvas: an organ is chosen like a link does it, nothing clears the organ and keeps the system. */
  private picked(organ: string | null) {
    const known = organ ? this.manifest.organs[organ] : undefined;
    if (!organ || !known) {
      this.setHash({ system: this.state.system, organ: null });
      return;
    }
    this.setHash({ system: known.system, organ });
    // The keyboard goes where the choice is described. From 48rem the panel is beside the stage: scrolling to it is wanted.
    const link = this.querySelector<HTMLElement>(`section[data-system] [data-organ="${CSS.escape(organ)}"] [data-organ-link]`);
    if (matchMedia(WIDE).matches) link?.focus();
    else link?.focus({ preventScroll: true });
  }

  private sheetOpen(section: Element): boolean {
    return this.hasAttribute('data-on') && !matchMedia(WIDE).matches && !!section.querySelector(':scope > h3 a[aria-current]');
  }

  /** The close button is the first child of each organ section, once; the CSS shows it only on the phone sheet. */
  private addCloseButtons() {
    const label = this.$('[data-stage]')?.dataset.tClose ?? 'Close';
    this.querySelectorAll<HTMLElement>('section[data-organ]').forEach((o) => {
      if (o.querySelector(':scope > .body-sheet-close')) return;
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'body-sheet-close';
      b.setAttribute('aria-label', label);
      b.innerHTML =
        '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
      b.addEventListener('click', () => this.closeSheet(), { signal: this.abort?.signal });
      o.prepend(b);
    });
  }

  /** Clears the organ, keeps the system, and gives the keyboard back to the stage. */
  private closeSheet() {
    this.setHash({ system: this.state.system, organ: null });
    this.$('[data-stage]')?.focus({ preventScroll: true });
  }

  private selectBy(dir: 1 | -1) {
    if (!this.ctrl) return;
    const organ = step(this.ctrl.organs(), this.state.organ, dir);
    if (organ && this.manifest.organs[organ]) this.setHash({ system: this.manifest.organs[organ].system, organ });
  }

  private act(a: string) {
    if (a === 'prev') return this.selectBy(-1);
    if (a === 'next') return this.selectBy(1);
    this.ctrl?.act(a as Act);
  }

  private onKey(ev: KeyboardEvent) {
    // Ctrl or Cmd with a key is a browser shortcut (zoom, find); Alt with an arrow is Back. AltGr (Ctrl+Alt) types [ and ].
    if (!this.ctrl || ev.metaKey || (ev.ctrlKey && !ev.altKey) || (ev.altKey && ev.key.startsWith('Arrow'))) return;
    const k = KEYS[ev.key];
    if (k) this.ctrl.act(k);
    else if (ev.key === '[') this.selectBy(-1);
    else if (ev.key === ']') this.selectBy(1);
    else if (ev.key === 'Escape') this.setHash({ system: this.state.system, organ: null });
    else return;
    ev.preventDefault();
  }

  /** three.js cannot parse light-dark(): let the browser resolve each token to rgb(...) through a probe. */
  private colors(): Colors {
    const probe = (this.probe ??= this.appendChild(Object.assign(document.createElement('span'), { hidden: true })));
    const out: Colors = {};
    for (const [key, token] of Object.entries(COLOR_VARS)) {
      probe.style.color = `var(${token})`;
      out[key] = getComputedStyle(probe).color;
    }
    return out;
  }

  private recolor() {
    this.ctrl?.setColors(this.colors());
  }

  /** three.js needs WebGL 2. The test context is given back at once: browsers keep only a few. */
  private hasWebGL(): boolean {
    const gl = document.createElement('canvas').getContext('webgl2');
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
    return !!gl;
  }

  private async start(manual: boolean) {
    if (this.ctrl || this.starting) return;
    if (!this.hasWebGL()) {
      this.dataset.webgl = 'off';
      this.say(this.dataset.tError!);
      return;
    }
    this.starting = true;
    if (manual) store.set(null);
    const stage = this.$('[data-stage]')!;
    const canvas = this.$('[data-canvas]') as HTMLCanvasElement;
    const label = this.$('[data-label]')!;
    const load = this.$('[data-load]') as HTMLButtonElement | null;
    stage.dataset.loading = '';
    this.say(this.dataset.tLoading!);
    if (load) load.setAttribute('aria-disabled', 'true');
    // The canvas needs a size before mount(); the poster still covers it.
    canvas.hidden = false;
    try {
      const { mount } = await import('./body-3d.ts');
      const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
      const ctrl = await mount(canvas, {
        manifestUrl: this.dataset.manifest!,
        reducedMotion,
        colors: this.colors(),
        published: this.published(),
        labelAt: (p) => this.place(label, p),
        onLost: () => this.lost(),
        onError: () => this.say(this.dataset.tError!),
        onPick: (organ) => this.picked(organ),
      });
      this.ctrl = ctrl;
      this.shownSystem = undefined;
      this.querySelectorAll<HTMLElement>('[data-poster]').forEach((p) => (p.hidden = true));
      this.dataset.webgl = 'on';
      this.setOn(true);
      this.recolor(); // the theme may have changed while the files were loading
      this.say(this.dataset.tReady!);
      // a smooth scroll to a fragment may still be travelling toward a position the hiding sections are about to remove
      scrollTo({ top: scrollY, behavior: 'instant' });
      if (this.interacted) this.scrollNext = true;
      this.sync();
    } catch (err) {
      console.error(err);
      this.stop();
      this.say(this.dataset.tError!);
    } finally {
      delete stage.dataset.loading;
      load?.removeAttribute('aria-disabled');
      this.starting = false;
    }
  }

  /** Buttons, stage focus and section visibility for the running (true) or stopped viewer. */
  private setOn(on: boolean) {
    const focused = document.activeElement as HTMLElement | null;
    const inside = !!focused && this.contains(focused);
    this.toggleAttribute('data-on', on);
    this.querySelectorAll<HTMLElement>('[data-act], [data-off]').forEach((b) => (b.hidden = !on));
    if (on) this.addCloseButtons();
    const load = this.$('[data-load]');
    if (load) load.hidden = on;
    const stage = this.$('[data-stage]');
    // The stage takes keys only while the model runs: without that it is a dead stop for the keyboard and a screen reader.
    if (on) {
      stage?.setAttribute('tabindex', '0');
      stage?.setAttribute('aria-describedby', 'body-help');
    } else {
      stage?.removeAttribute('tabindex');
      stage?.removeAttribute('aria-describedby');
    }
    // A focused control that has just been hidden would leave the keyboard on <body>: put it where the learner can go on.
    if (inside && focused && (focused.hidden || focused.closest('[hidden]'))) (on ? stage : load)?.focus({ preventScroll: true });
    this.sections();
  }

  private stop() {
    this.ctrl?.dispose();
    this.ctrl = undefined;
    this.shownSystem = undefined;
    // A new canvas for the next start: a context that has been given up is not reused.
    const old = this.$('[data-canvas]');
    if (old) {
      const fresh = old.cloneNode(false) as HTMLElement;
      fresh.hidden = true;
      old.replaceWith(fresh);
    }
    const label = this.$('[data-label]');
    if (label) label.hidden = true;
    this.querySelectorAll<HTMLElement>('[data-poster]').forEach((p) => (p.hidden = false));
    this.dataset.webgl = 'off';
    this.setOn(false);
  }

  private turnOff() {
    this.stop();
    store.set('off');
    this.say(this.dataset.tOff!);
    this.$('[data-load]')?.focus();
  }

  /** The browser took the WebGL context away (or a frame failed): poster back, the load button is "try again". */
  private lost() {
    this.stop();
    this.say(this.dataset.tLost!);
  }

  private place(label: HTMLElement, point: { x: number; y: number } | null) {
    if (!point || !this.state.organ) {
      label.hidden = true;
      return;
    }
    const text = this.organName(this.state.organ);
    if (label.textContent !== text) label.textContent = text;
    label.hidden = false;
    // transform, not left and top: a label that moves by layout counts as layout shift on every frame. It stays inside the
    // stage; --dx keeps the end of its leader line on the organ when it had to be pushed back.
    const half = label.offsetWidth / 2;
    const x = Math.min(Math.max(point.x, half + 4), label.parentElement!.clientWidth - half - 4);
    label.style.setProperty('--dx', `${point.x - x}px`);
    label.style.transform = `translate(${x}px, ${point.y}px) translate(-50%, calc(-100% - 0.9em))`;
  }
}

if (!customElements.get('ap-body')) customElements.define('ap-body', ApBody);

export {};
