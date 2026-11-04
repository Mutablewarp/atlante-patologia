/**
 * <ap-pathway>: one step at a time. Previous/next buttons move the current step;
 * the SVG diagram reveals boxes up to it, the step list marks it with
 * aria-current="step", a role=status line announces it, and an `ap-step` event
 * tells <ap-structure> (structure-viewer.ts) to follow. Without JS every step
 * and the whole diagram stay visible. Markup: components/pathway/Pathway.astro.
 */
class ApPathway extends HTMLElement {
  private i = 0;
  private items: HTMLElement[] = [];

  connectedCallback() {
    this.items = [...this.querySelectorAll<HTMLElement>('[data-step-item]')];
    this.querySelector('[data-step-prev]')?.addEventListener('click', () => this.go(this.i - 1, true));
    this.querySelector('[data-step-next]')?.addEventListener('click', () => this.go(this.i + 1, true));
    this.addEventListener('ap-step-request', (e) => this.go(this.i + (e as CustomEvent<number>).detail, true));
    this.dataset.ready = '';
    // The child <ap-structure> may upgrade after us: let it register first.
    queueMicrotask(() => this.go(0, false));
  }

  private go(i: number, announce: boolean) {
    const total = this.items.length;
    this.i = Math.max(0, Math.min(total - 1, i));
    this.items.forEach((li, k) => (k === this.i ? li.setAttribute('aria-current', 'step') : li.removeAttribute('aria-current')));
    this.querySelectorAll<SVGElement>('[data-step-box]').forEach((g) => {
      const k = Number(g.dataset.stepBox);
      g.dataset.state = k < this.i ? 'done' : k === this.i ? 'current' : 'future';
    });
    const fill = (t = '') => t.replace('{n}', String(this.i + 1)).replace('{total}', String(total));
    const counter = this.querySelector('[data-step-counter]');
    if (counter) counter.textContent = fill(this.dataset.tCounter);
    // aria-disabled, not disabled: a focused button must keep focus at the ends.
    this.querySelector('[data-step-prev]')?.setAttribute('aria-disabled', String(this.i === 0));
    this.querySelector('[data-step-next]')?.setAttribute('aria-disabled', String(this.i === total - 1));
    const status = this.querySelector('[data-step-status]');
    const title = this.items[this.i]?.querySelector('[data-step-title]')?.textContent?.trim() ?? '';
    if (status && announce) status.textContent = fill(this.dataset.tStatus).replace('{title}', title);
    this.dispatchEvent(new CustomEvent('ap-step', { detail: this.i }));
  }
}

if (!customElements.get('ap-pathway')) customElements.define('ap-pathway', ApPathway);

export {};
