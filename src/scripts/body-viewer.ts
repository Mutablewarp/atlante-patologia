/**
 * <ap-body>: the stage of the body page (docs/BODY_SPEC.md §1, §5, §6). Poster, canvas and buttons come as static
 * HTML (components/body/BodyViewer.astro); the tree of systems and organs is the data: the element reads it from the
 * DOM and needs no second source. Selection goes through location.hash only. The 3D part (body-3d.ts, three.js) is
 * a dynamic import started by the load rule: idle from 48rem, a click below it, never with save-data or after
 * "turn 3D off". If anything fails, the poster, the tree and the chips stay.
 */
import { parseHash, step, toHash, type BodyManifest, type BodyState } from '../lib/body-view.ts';
import type { Colors, Controller } from './body-3d.ts';

const STORE_KEY = 'ap-body-3d';
const WIDE = '(min-width: 48rem)';
const COLOR_VARS = { eosin: '--eosin', hema: '--hema', ink: '--ink', surface2: '--surface-2' } as const;
const KEYS: Record<string, 'left' | 'right' | 'up' | 'down' | 'in' | 'out' | 'reset'> = {
  ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', '+': 'in', '=': 'in', '-': 'out', '0': 'reset',
};
type Act = Parameters<Controller['act']>[0];

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

class ApBody extends HTMLElement {
  private manifest: BodyManifest = { organs: {} };
  private ctrl?: Controller;
  private starting = false;
  private shownSystem: string | null | undefined; // undefined: nothing shown yet, so the whole body (null) still loads its systems
  private state: BodyState = { system: null, organ: null };
  private queue: Promise<void> = Promise.resolve();
  private probe?: HTMLElement;

  connectedCallback() {
    this.manifest = this.readTree();
    this.$('[data-load]')?.addEventListener('click', () => void this.start(true));
    this.$('[data-off]')?.addEventListener('click', () => this.turnOff());
    this.querySelectorAll<HTMLElement>('[data-poster]').forEach((p) => p.addEventListener('click', () => void this.start(true)));
    this.querySelectorAll<HTMLButtonElement>('[data-act]').forEach((b) => b.addEventListener('click', () => this.act(b.dataset.act!)));
    this.$('[data-stage]')?.addEventListener('keydown', (ev) => this.onKey(ev as KeyboardEvent));
    addEventListener('hashchange', () => this.sync());
    new MutationObserver(() => this.recolor()).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => this.recolor());
    this.sync();
    if (this.autoStart()) {
      const go = () => void this.start(false);
      if ('requestIdleCallback' in window) requestIdleCallback(go);
      else setTimeout(go, 200);
    }
  }

  private $ = (s: string) => this.querySelector<HTMLElement>(s);

  private say(text: string) {
    const s = this.$('[data-status]');
    if (s) s.textContent = text;
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
    const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
    return matchMedia(WIDE).matches && !saveData && store.get() !== 'off';
  }

  private sync() {
    const next = parseHash(location.hash, this.manifest);
    this.state = next;
    for (const key of ['system', 'organ'] as const) {
      if (next[key]) this.dataset[key] = next[key]!;
      else delete this.dataset[key];
    }
    this.sections();
    const run = this.queue.then(() => this.apply(next));
    this.queue = run.catch((err) => console.error(err));
  }

  private async apply(state: BodyState) {
    const c = this.ctrl;
    if (!c || state !== this.state) return;
    if (state.system !== this.shownSystem) {
      this.shownSystem = state.system;
      await c.showSystem(state.system);
    }
    if (state !== this.state) return;
    c.select(state.organ);
    if (state.organ && matchMedia(WIDE).matches) document.getElementById(`organ-${state.organ}`)?.scrollIntoView({ block: 'nearest' });
    this.say(this.message(state));
  }

  private message(state: BodyState): string {
    if (state.organ) {
      const section = this.querySelector(`section[data-organ="${CSS.escape(state.organ)}"]`);
      if (section?.getAttribute('data-kind') === 'none') return this.dataset.tNoModel!;
      const n = section?.querySelector('h3 .count')?.textContent?.trim() ?? '';
      return this.dataset.tOrgan!.replace('{organ}', this.organName(state.organ)).replace('{n}', n);
    }
    if (state.system) return this.dataset.tSystem!.replace('{system}', this.systemName(state.system));
    return this.dataset.tWhole!;
  }

  /** With the viewer running and a system selected only that system shows; otherwise every section stays visible, so the
   *  viewer starting by itself shifts nothing. */
  private sections() {
    const only = this.hasAttribute('data-on') ? this.state.system : null;
    this.querySelectorAll<HTMLElement>(':scope > section[data-system]').forEach((s) => (s.hidden = only !== null && s.dataset.system !== only));
  }

  /** The hash stays the one source of truth, but pushState does not scroll the page away from the stage; Back still fires hashchange. */
  private setHash(state: BodyState) {
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
    if (!this.ctrl || ev.ctrlKey || ev.metaKey || ev.altKey) return;
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
    const out: Record<string, string> = {};
    for (const [key, token] of Object.entries(COLOR_VARS)) {
      probe.style.color = `var(${token})`;
      out[key] = getComputedStyle(probe).color;
    }
    return out as unknown as Colors;
  }

  private recolor() {
    this.ctrl?.setColors(this.colors());
  }

  private async start(manual: boolean) {
    if (this.ctrl || this.starting) return;
    const probe = document.createElement('canvas');
    if (!(probe.getContext('webgl2') ?? probe.getContext('webgl'))) {
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
      });
      this.ctrl = ctrl;
      this.shownSystem = undefined;
      this.querySelectorAll<HTMLElement>('[data-poster]').forEach((p) => (p.hidden = true));
      this.dataset.webgl = 'on';
      this.setOn(true);
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

  /** Buttons and section visibility for the running (true) or stopped viewer. */
  private setOn(on: boolean) {
    this.toggleAttribute('data-on', on);
    this.querySelectorAll<HTMLElement>('[data-act], [data-off]').forEach((b) => (b.hidden = !on));
    const load = this.$('[data-load]');
    if (load) load.hidden = on;
    this.sections();
  }

  private stop() {
    this.ctrl?.dispose();
    this.ctrl = undefined;
    this.shownSystem = undefined;
    (this.$('[data-canvas]') as HTMLElement).hidden = true;
    (this.$('[data-label]') as HTMLElement).hidden = true;
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

  /** The browser took the WebGL context away: poster back, the load button is "try again". */
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
    Object.assign(label.style, { left: `${point.x}px`, top: `${point.y}px`, right: 'auto', bottom: 'auto', transform: 'translate(-50%, -120%)' });
  }
}

if (!customElements.get('ap-body')) customElements.define('ap-body', ApBody);

export {};
