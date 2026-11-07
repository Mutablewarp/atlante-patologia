/**
 * <ap-structure>: poster image + "Load the 3D view" button. On click it imports
 * structure-3d.ts (3Dmol) and shows the local structure of the current pathway
 * step, with our own buttons (rotate, zoom, reset, labels, previous/next step),
 * arrow/+/−/0 keys on the stage and role=status announcements. No auto-spin;
 * no animation under prefers-reduced-motion. Without WebGL, or if anything
 * fails, the poster, the description and the 2D steps stay.
 * Markup: components/pathway/StructureViewer.astro. Steps come from the parent
 * <ap-pathway> (pathway.ts) through `ap-step` events.
 */
import type { ViewerStep } from '../lib/pathways.ts';
import type { Controller } from './structure-3d.ts';

class ApStructure extends HTMLElement {
  private steps: ViewerStep[] = [];
  private index = 0;
  private ctrl?: Controller;
  private labelsOn = true;
  private queue = Promise.resolve();

  connectedCallback() {
    this.steps = JSON.parse(this.querySelector('[data-steps]')?.textContent ?? '[]');
    this.closest('ap-pathway')?.addEventListener('ap-step', (e) => void this.go((e as CustomEvent<number>).detail).catch((err) => this.broken(err)));
    this.$('[data-load]')?.addEventListener('click', () => void this.load());
    this.querySelectorAll<HTMLButtonElement>('[data-act]').forEach((b) => b.addEventListener('click', () => this.act(b.dataset.act!, b)));
    this.$('[data-stage]')?.addEventListener('keydown', (ev) => {
      const k = ({ ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', '+': 'in', '=': 'in', '-': 'out', '0': 'reset' } as Record<string, string>)[ev.key];
      if (!k || !this.ctrl || ev.ctrlKey || ev.metaKey || ev.altKey) return;
      ev.preventDefault();
      this.act(k);
    });
    this.go(0);
  }

  private $ = (s: string) => this.querySelector<HTMLElement>(s);

  private say(text: string) {
    const s = this.$('[data-status]');
    if (s) s.textContent = text;
  }

  /** Structure shown for step i: its own, else the closest earlier one, else the first. */
  private structureAt(i: number) {
    for (let k = i; k >= 0; k--) if (this.steps[k]?.structure) return k;
    return this.steps.findIndex((s) => s.structure);
  }

  private go(i: number) {
    this.index = i;
    const id = this.steps[this.structureAt(i)]?.structure;
    this.querySelectorAll<HTMLElement>('[data-for]').forEach((el) => (el.hidden = el.dataset.for !== id));
    if (id) this.$('[data-stage]')?.setAttribute('aria-describedby', `structure-desc-${id}`);
    // Draws run one after another and always draw the latest step, so fast clicks never leave a stale model;
    // a failed draw does not block the ones after it (its caller gets the error).
    const run = this.queue.then(() => this.draw());
    this.queue = run.catch(() => undefined);
    return run;
  }

  private async draw() {
    const i = this.index;
    const k = this.structureAt(i);
    if (!this.ctrl || k < 0) return;
    const n = await this.ctrl.show(this.steps[k]!);
    this.dataset.shown = `${this.steps[k]!.structure}:${k}`;
    this.dataset.highlightAtoms = String(n);
    if (k !== i) this.say(this.dataset.tNone!);
  }

  private act(a: string, b?: HTMLButtonElement) {
    const c = this.ctrl;
    if (a === 'prev' || a === 'next') this.closest('ap-pathway')?.dispatchEvent(new CustomEvent('ap-step-request', { detail: a === 'next' ? 1 : -1 }));
    if (!c) return;
    if (a === 'left' || a === 'right') c.rotate('y', a === 'left' ? -30 : 30);
    if (a === 'up' || a === 'down') c.rotate('x', a === 'up' ? -30 : 30);
    if (a === 'in' || a === 'out') c.zoom(a === 'in' ? 1.25 : 0.8);
    if (a === 'reset') c.reset();
    if (a === 'labels') {
      this.labelsOn = !this.labelsOn;
      c.labels(this.labelsOn);
      b?.setAttribute('aria-pressed', String(this.labelsOn));
    }
  }

  private async load() {
    const button = this.$('[data-load]')!;
    const stage = this.$('[data-stage]')!;
    if (button.getAttribute('aria-disabled') === 'true') return;
    const canvas = document.createElement('canvas');
    if (!(canvas.getContext('webgl2') ?? canvas.getContext('webgl'))) return this.fail();
    // The button stays in place (and keeps focus) while loading; focus moves to the stage or the fallback after.
    button.setAttribute('aria-disabled', 'true');
    button.textContent = this.dataset.tLoading!;
    this.say(this.dataset.tLoading!);
    try {
      const { mount } = await import('./structure-3d.ts');
      this.ctrl = await mount(this.$('[data-canvas]')!, this.dataset.base!, matchMedia('(prefers-reduced-motion: reduce)').matches);
      await this.go(this.index);
      this.dataset.loaded = '';
      this.$('[data-tools]')!.hidden = false;
      button.hidden = true;
      stage.tabIndex = 0;
      stage.focus();
      this.say(this.dataset.tReady!);
    } catch (err) {
      this.broken(err);
    }
  }

  /** The import, WebGL or a structure file failed, at load or on a later step: back to the poster, description and steps. */
  private broken(err: unknown) {
    console.error(err);
    this.ctrl = undefined;
    this.fail();
  }

  private fail() {
    // Focus moves only when it was on a control that disappears now (or nowhere): keep the keyboard user's place.
    const lost = !document.activeElement || document.activeElement === document.body || this.contains(document.activeElement);
    delete this.dataset.loaded;
    for (const s of ['[data-load]', '[data-tools]', '[data-canvas]']) this.$(s)!.hidden = true;
    this.$('[data-stage]')!.removeAttribute('tabindex');
    const fallback = this.$('[data-fallback]')!;
    fallback.hidden = false;
    if (lost) fallback.focus();
    this.say(this.dataset.tFail!);
  }
}

if (!customElements.get('ap-structure')) customElements.define('ap-structure', ApStructure);

export {};
