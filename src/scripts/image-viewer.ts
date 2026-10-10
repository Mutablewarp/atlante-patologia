/**
 * <ap-image-viewer>: zoom (buttons, + / − / 0 keys, Ctrl+wheel, pinch), pan
 * (drag, arrow keys), label toggle and progressive reveal by `revealOrder`.
 * Markup comes from components/horizontal/ImageViewer.astro.
 */
const MAX = 6;

class ApImageViewer extends HTMLElement {
  private s = 1;
  private x = 0;
  private y = 0;
  private revealed = 0;
  private stage!: HTMLElement;
  private canvas!: HTMLElement;
  private pointers = new Map<number, { x: number; y: number }>();

  connectedCallback() {
    this.stage = this.querySelector('.viewer-stage')!;
    this.canvas = this.querySelector('.viewer-canvas')!;
    const total = Number(this.dataset.total ?? 0);
    this.revealed = total;

    this.querySelectorAll<HTMLButtonElement>('[data-zoom]').forEach((b) =>
      b.addEventListener('click', () => {
        const z = b.dataset.zoom;
        if (z === 'reset') this.reset();
        else this.zoomBy(z === 'in' ? 1.5 : 1 / 1.5);
      }),
    );
    this.querySelector('[data-label-toggle]')?.addEventListener('click', () => this.setRevealed(this.revealed === total ? 0 : total));
    this.querySelector('[data-reveal]')?.addEventListener('click', () => {
      const next = this.revealed >= total ? 1 : this.revealed + 1;
      this.setRevealed(next);
      const label = this.querySelector(`.viewer-legend li[data-order="${next}"]`)?.textContent ?? '';
      const status = this.querySelector('[data-viewer-status]');
      if (status) status.textContent = `${next}/${total}: ${label}`;
    });

    this.stage.addEventListener('keydown', (ev) => {
      const step = 40;
      const keys: Record<string, () => void> = {
        '+': () => this.zoomBy(1.5),
        '=': () => this.zoomBy(1.5),
        '-': () => this.zoomBy(1 / 1.5),
        '0': () => this.reset(),
        ArrowLeft: () => this.pan(step, 0),
        ArrowRight: () => this.pan(-step, 0),
        ArrowUp: () => this.pan(0, step),
        ArrowDown: () => this.pan(0, -step),
      };
      const fn = keys[ev.key];
      // Arrow keys scroll the page normally while the image is not zoomed.
      if (!fn || (ev.key.startsWith('Arrow') && this.s === 1) || ev.ctrlKey || ev.metaKey || ev.altKey) return;
      ev.preventDefault();
      fn();
    });
    this.stage.addEventListener(
      'wheel',
      (ev) => {
        if (!ev.ctrlKey) return; // trackpad pinch arrives as Ctrl+wheel; plain wheel scrolls the page
        ev.preventDefault();
        this.zoomBy(Math.exp(-ev.deltaY / 200), ev.clientX, ev.clientY);
      },
      { passive: false },
    );
    this.stage.addEventListener('pointerdown', (ev) => {
      this.pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
      this.stage.setPointerCapture(ev.pointerId);
    });
    this.stage.addEventListener('pointermove', (ev) => {
      const prev = this.pointers.get(ev.pointerId);
      if (!prev) return;
      const cur = { x: ev.clientX, y: ev.clientY };
      if (this.pointers.size === 2) {
        const other = [...this.pointers.entries()].find(([id]) => id !== ev.pointerId)![1];
        const before = Math.hypot(prev.x - other.x, prev.y - other.y);
        const after = Math.hypot(cur.x - other.x, cur.y - other.y);
        if (before > 0) this.zoomBy(after / before, (cur.x + other.x) / 2, (cur.y + other.y) / 2);
      } else if (this.s > 1) {
        this.pan(cur.x - prev.x, cur.y - prev.y);
      }
      this.pointers.set(ev.pointerId, cur);
    });
    const up = (ev: PointerEvent) => this.pointers.delete(ev.pointerId);
    this.stage.addEventListener('pointerup', up);
    this.stage.addEventListener('pointercancel', up);
    this.apply();
  }

  private setRevealed(n: number) {
    this.revealed = n;
    this.querySelectorAll<HTMLElement | SVGElement>('[data-order]').forEach((el) => {
      const hide = Number(el.dataset.order) > n;
      el.toggleAttribute('hidden', hide);
      el.style.display = hide ? 'none' : '';
    });
    this.querySelector('[data-label-toggle]')?.setAttribute('aria-pressed', String(n > 0));
  }

  private zoomBy(f: number, cx?: number, cy?: number) {
    const r = this.stage.getBoundingClientRect();
    const px = (cx ?? r.left + r.width / 2) - r.left;
    const py = (cy ?? r.top + r.height / 2) - r.top;
    const s = Math.min(MAX, Math.max(1, this.s * f));
    // Keep the point under the cursor/fingers fixed.
    this.x = px - ((px - this.x) * s) / this.s;
    this.y = py - ((py - this.y) * s) / this.s;
    this.s = s;
    this.apply();
  }

  private pan(dx: number, dy: number) {
    this.x += dx;
    this.y += dy;
    this.apply();
  }

  private reset() {
    this.s = 1;
    this.x = 0;
    this.y = 0;
    this.apply();
  }

  private apply() {
    const r = this.stage.getBoundingClientRect();
    this.x = Math.min(0, Math.max(r.width - r.width * this.s, this.x));
    this.y = Math.min(0, Math.max(r.height - r.height * this.s, this.y));
    this.canvas.style.transform = `translate(${this.x}px, ${this.y}px) scale(${this.s})`;
    this.stage.dataset.zoomed = String(this.s > 1);
  }
}

if (!customElements.get('ap-image-viewer')) customElements.define('ap-image-viewer', ApImageViewer);

export {};
