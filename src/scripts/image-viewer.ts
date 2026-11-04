/**
 * <ap-image-viewer>: zoom (buttons, + / − / 0 keys, Ctrl+wheel, pinch, double
 * click or tap), pan (drag, arrow keys, and pan buttons for WCAG 2.5.7), label
 * toggle, progressive reveal by `revealOrder`, numbered markers for labels that
 * would cover each other, a scale bar when `mpp` is
 * known, a switch between the images of one group (stain, section,
 * magnification) and a full-screen dialog that Escape or Back closes.
 * Markup comes from components/horizontal/ImageViewer.astro.
 */
import { scaleBar } from '../lib/image-meta.ts';

const MAX = 6;
const PAN: Record<string, [number, number]> = { left: [1, 0], right: [-1, 0], up: [0, 1], down: [0, -1] };

class ApImageViewer extends HTMLElement {
  private s = 1;
  private x = 0;
  private y = 0;
  private total = 0;
  private revealed = 0;
  private panel!: HTMLElement;
  private stage!: HTMLElement;
  private canvas!: HTMLElement;
  private body!: HTMLElement;
  private dialog!: HTMLDialogElement;
  private pointers = new Map<number, { x: number; y: number }>();
  private moved = 0;
  private tap?: { t: number; x: number; y: number };

  connectedCallback() {
    this.body = this.querySelector('.viewer-body')!;
    this.dialog = this.querySelector('dialog')!;
    const full = this.querySelector<HTMLButtonElement>('[data-full]')!;

    this.addEventListener('click', (ev) => {
      const d = (ev.target as Element).closest('button')?.dataset;
      if (!d) return;
      if (d.zoom === 'reset') this.reset();
      else if (d.zoom) this.zoomBy(d.zoom === 'in' ? 1.5 : 1 / 1.5);
      else if (d.pan) {
        if (this.s === 1) return; // aria-disabled (not disabled), so focus stays on the button at 1×
        const r = this.stage.getBoundingClientRect();
        const [dx, dy] = PAN[d.pan]!;
        this.pan(dx * r.width * 0.2, dy * r.height * 0.2);
      } else if ('labelToggle' in d) this.setRevealed(this.revealed === this.total ? 0 : this.total);
      else if ('reveal' in d) {
        const next = this.revealed >= this.total ? 1 : this.revealed + 1;
        this.setRevealed(next);
        const label = this.panel.querySelector(`.viewer-legend li[data-order="${next}"]`)?.textContent ?? '';
        this.say(`${next}/${this.total}: ${label}`);
      } else if ('full' in d) {
        if (this.dialog.open) return this.dialog.close();
        this.dialog.append(this.body);
        this.dialog.showModal();
        history.pushState({ apViewer: true }, '');
        full.textContent = d.close!;
        this.recenter();
      }
    });
    this.addEventListener('change', (ev) => {
      const r = ev.target as HTMLInputElement;
      if (r.type !== 'radio') return;
      this.select(r.value);
      this.say(r.closest('label')?.textContent?.trim() ?? '');
    });
    this.dialog.addEventListener('close', () => {
      this.dialog.before(this.body);
      full.textContent = full.dataset.open!;
      if (history.state?.apViewer) history.back();
      this.recenter();
      full.focus();
    });
    addEventListener('popstate', () => this.dialog.open && this.dialog.close());

    this.querySelectorAll<HTMLElement>('.viewer-stage').forEach((st) => {
      st.addEventListener('keydown', (ev) => {
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
      st.addEventListener(
        'wheel',
        (ev) => {
          // Trackpad pinch arrives as Ctrl+wheel; a plain wheel scrolls the page, except in full screen.
          if (!ev.ctrlKey && !this.dialog.open) return;
          ev.preventDefault();
          this.zoomBy(Math.exp(-ev.deltaY / 200), ev.clientX, ev.clientY);
        },
        { passive: false },
      );
      st.addEventListener('pointerdown', (ev) => {
        this.pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
        this.moved = 0;
        st.setPointerCapture(ev.pointerId);
      });
      st.addEventListener('pointermove', (ev) => {
        const prev = this.pointers.get(ev.pointerId);
        if (!prev) return;
        const cur = { x: ev.clientX, y: ev.clientY };
        this.moved += Math.abs(cur.x - prev.x) + Math.abs(cur.y - prev.y);
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
      const up = (ev: PointerEvent) => {
        this.pointers.delete(ev.pointerId);
        if (ev.type !== 'pointerup' || this.pointers.size > 0 || this.moved > 10) return;
        // Double click or double tap: zoom in at that point, back to fit at the maximum.
        const t = this.tap;
        if (t && ev.timeStamp - t.t < 400 && Math.hypot(ev.clientX - t.x, ev.clientY - t.y) < 30) {
          this.tap = undefined;
          if (this.s >= MAX) this.reset();
          else this.zoomBy(2, ev.clientX, ev.clientY);
        } else this.tap = { t: ev.timeStamp, x: ev.clientX, y: ev.clientY };
      };
      st.addEventListener('pointerup', up);
      st.addEventListener('pointercancel', up);
    });
    this.select(this.querySelector<HTMLElement>('.viewer-panel:not([hidden])')?.dataset.panel ?? '0');
    // Labels are re-fitted when the stage changes size (window, full screen) and once the web fonts are in.
    new ResizeObserver(() => this.fitLabels()).observe(this.body);
    void document.fonts.ready.then(() => this.fitLabels());
  }

  /** A label that would cover another one shows only its number; the numbered legend below has the text. */
  private fitLabels() {
    const labels = [...this.panel.querySelectorAll<HTMLElement>('.viewer-label')];
    // Unrevealed labels are measured too, so revealing one never re-flows the others; nothing paints in between.
    const hidden = labels.filter((l) => l.hidden);
    const show = (on: boolean) =>
      hidden.forEach((l) => {
        l.hidden = !on;
        l.style.display = on ? '' : 'none';
      });
    show(true);
    labels.forEach((l) => delete l.dataset.num);
    const hit = (a: DOMRect, b: DOMRect) =>
      Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1;
    // Each pass turns the colliding text labels into numbers; a second pass catches a number landing on a text.
    for (let pass = 0; pass < 3; pass++) {
      const boxes = labels.map((l) => l.getBoundingClientRect());
      const crowded = labels.filter((l, i) => l.dataset.num === undefined && boxes.some((b, j) => j !== i && hit(b, boxes[i]!)));
      if (!crowded.length) break;
      crowded.forEach((l) => (l.dataset.num = ''));
    }
    show(false);
  }

  /** Show image `i` of the group; the zoom level stays, the position resets (sections are not registered). */
  private select(i: string) {
    (this.closest('figure') ?? this).querySelectorAll<HTMLElement>('[data-panel]').forEach((el) => (el.hidden = el.dataset.panel !== i));
    this.panel = this.querySelector(`.viewer-panel[data-panel="${i}"]`)!;
    this.stage = this.panel.querySelector('.viewer-stage')!;
    this.canvas = this.panel.querySelector('.viewer-canvas')!;
    this.total = Number(this.panel.dataset.total);
    // The dialog is named after the image shown now, not the one active at build time.
    this.dialog.setAttribute('aria-label', this.canvas.querySelector('img')?.alt ?? '');
    this.querySelectorAll<HTMLButtonElement>('[data-label-toggle], [data-reveal]').forEach((b) => (b.disabled = this.total === 0));
    this.setRevealed(this.total);
    this.recenter();
    this.fitLabels();
  }

  private say(text: string) {
    const status = this.querySelector('[data-viewer-status]');
    if (status) status.textContent = text;
  }

  private setRevealed(n: number) {
    this.revealed = n;
    this.panel.querySelectorAll<HTMLElement | SVGElement>('[data-order]').forEach((el) => {
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

  private recenter() {
    this.x = 0;
    this.y = 0;
    this.apply();
  }

  private reset() {
    this.s = 1;
    this.recenter();
  }

  private apply() {
    const r = this.stage.getBoundingClientRect();
    this.x = Math.min(0, Math.max(r.width - r.width * this.s, this.x));
    this.y = Math.min(0, Math.max(r.height - r.height * this.s, this.y));
    this.canvas.style.transform = `translate(${this.x}px, ${this.y}px) scale(${this.s})`;
    this.stage.dataset.zoomed = String(this.s > 1);
    this.querySelectorAll<HTMLButtonElement>('[data-pan]').forEach((b) => b.setAttribute('aria-disabled', String(this.s === 1)));
    // Past 1.5× (or in full screen) widen `sizes` once so the browser fetches the sharper srcset candidate.
    const img = this.canvas.querySelector('img');
    if (img?.srcset && (this.s > 1.5 || this.dialog.open)) {
      const want = Math.ceil(r.width * (this.s > 1.5 ? MAX : 1));
      if (want > (parseInt(img.sizes) || 0)) img.sizes = `${want}px`;
    }
    const bar = this.stage.querySelector<HTMLElement>('[data-scale]');
    const sb = bar && scaleBar(Number(this.panel.dataset.mpp), Number(this.panel.dataset.w), r.width * this.s);
    if (bar && sb) {
      bar.style.width = `${sb.px}px`;
      bar.textContent = sb.um >= 1000 ? `${sb.um / 1000} mm` : `${sb.um} µm`;
    }
  }
}

if (!customElements.get('ap-image-viewer')) customElements.define('ap-image-viewer', ApImageViewer);

export {};
