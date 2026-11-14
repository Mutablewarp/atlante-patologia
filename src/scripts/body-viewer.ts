/**
 * <ap-body>: the stage of the body page (docs/BODY_SPEC.md §1, §5, §6). Poster, canvas and buttons come as static
 * HTML (components/body/BodyViewer.astro); the tree of systems and organs is the data: the element reads it from the
 * DOM and needs no second source. Selection goes through location.hash only. The 3D part (body-3d.ts, three.js) is
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
    addEventListener(
      'hashchange',
      () => {
        this.interacted = true;
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
    this.querySelectorAll<HTMLElement>('section[data-system] > section[data-organ]').forEach((o) => {
      const system = o.parentElement!.dataset.system!;
      organs[o.dataset.organ!] = { system, kind: 'none', of: [], inside: null };
    });
    return { organs };
  }

  private published(): string[] {
    return [...this.querySelectorAll<HTMLElement>('section[data-organ]')].filter((o) => o.querySelector('.body-cards li')).map((o) => o.dataset.organ!);
  }

  private organName(id: string): string {
    return this.querySelector(`section[data-organ="${CSS.escape(id)}"] > h3 a`)?.textContent?.trim() ?? id;
  }

  private systemName(id: string): string {
    const h = this.querySelector(`section[data-system="${CSS.escape(id)}"] > h2`)?.cloneNode(true) as HTMLElement | undefined;
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
    this.sections();
    const run = this.queue.then(() => this.apply(next));
    this.queue = run.catch((err) => console.error(err));
  }

  /** aria-current on the chip of the selected system and on the link of the selected organ. */
  private mark() {
    const { system, organ } = this.state;
    this.querySelectorAll<HTMLElement>('.body-systems a[data-system]').forEach((a) => flag(a, a.dataset.system === system));
    this.querySelectorAll<HTMLElement>('section[data-organ]').forEach((o) => {
      const link = o.querySelector(':scope > h3 a');
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
    if (state.organ && matchMedia(WIDE).matches) document.getElementById(`organ-${state.organ}`)?.scrollIntoView({ block: 'nearest' });
    this.say(this.message(state));
  }

  private message(state: BodyState): string {
    if (state.organ) {
      const section = this.querySelector(`section[data-organ="${CSS.escape(state.organ)}"]`);
      const name = this.organName(state.organ);
      if (section?.getAttribute('data-kind') === 'none') return this.dataset.tNoModel!.replace('{organ}', name);
      const n = section?.querySelector('h3 .count')?.textContent?.trim() ?? '';
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
    history.pushState(null, '', toHash(state) || location.pathname + location.search);
    this.sync();
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
      });
      this.ctrl = ctrl;
      this.shownSystem = undefined;
      this.querySelectorAll<HTMLElement>('[data-poster]').forEach((p) => (p.hidden = true));
      this.dataset.webgl = 'on';
      this.setOn(true);
      this.recolor(); // the theme may have changed while the files were loading
      this.say(this.dataset.tReady!);
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
    // transform, not left and top: a label that moves by layout counts as layout shift on every frame
    label.style.transform = `translate(${point.x}px, ${point.y}px) translate(-50%, -120%)`;
  }
}

if (!customElements.get('ap-body')) customElements.define('ap-body', ApBody);

export {};
