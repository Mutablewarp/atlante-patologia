/**
 * Personal-layer custom elements, usable from any page (BaseLayout loads this
 * module only when one of them is present):
 *
 *   <ap-recent></ap-recent>                       last 20 viewed cards
 *   <ap-resume></ap-resume>                       last card + section anchor
 *   <ap-path-progress entities="a,b,c"></ap-path-progress>   read / in-review count with a bar
 *   <ap-due-count></ap-due-count>                 reviews due today
 *   <ap-export-reminder></ap-export-reminder>     gentle backup reminder (14 days, dismissible)
 *
 * Elements render nothing until data is read, and stay empty without IndexedDB.
 */
import { fmt, isLang, type Lang } from '../i18n/index.ts';
import { tS } from '../i18n/study.ts';
import { SECTIONS, QUICK_CHECK } from '../i18n/sections.ts';
import { getAll, getSetting, setSetting, hasData, reminderDue } from '../lib/db.ts';
import { entitiesRead, dueCount } from '../lib/progress.ts';
import { langPath } from '../lib/url.ts';

const lang = (): Lang => (isLang(document.documentElement.lang) ? (document.documentElement.lang as Lang) : 'it');
const t = (k: Parameters<typeof tS>[1]) => tS(lang(), k);
const el = <K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string> = {}, text?: string) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  if (text !== undefined) n.textContent = text;
  return n;
};
const sectionTitle = (id: string) => [...SECTIONS, QUICK_CHECK].find((s) => s.id === id)?.short[lang()] ?? id;

/** Base: re-render on connect and whenever the learner's data changes (ap:data). */
abstract class Live extends HTMLElement {
  private onData = () => void this.update();
  connectedCallback() {
    window.addEventListener('ap:data', this.onData);
    void this.update();
  }
  disconnectedCallback() {
    window.removeEventListener('ap:data', this.onData);
  }
  async update() {
    try {
      await this.render();
    } catch {
      /* IndexedDB unavailable (private mode, blocked storage): stay empty */
    }
  }
  abstract render(): Promise<void>;
}

class ApRecent extends Live {
  async render() {
    const rows = (await getAll('recent')).sort((a, b) => b.at - a.at);
    if (!rows.length) return void this.replaceChildren(el('p', { class: 'small muted' }, t('recentEmpty')));
    const ul = el('ul', { class: 'recent-list' });
    for (const r of rows) {
      const li = el('li');
      li.append(el('a', { href: langPath(lang(), `e/${r.id}/`) }, r.names[lang()]));
      ul.append(li);
    }
    this.replaceChildren(ul);
  }
}

class ApResume extends Live {
  async render() {
    const last = (await getAll('recent')).sort((a, b) => b.at - a.at)[0];
    if (!last) return void this.replaceChildren(el('p', { class: 'small muted' }, t('resumeEmpty')));
    const a = el('a', { class: 'card link-card resume-link', href: langPath(lang(), `e/${last.id}/${last.section ? `#${last.section}` : ''}`) });
    a.append(el('span', { class: 'kicker' }, t('resumeTitle')), el('strong', {}, last.names[lang()]));
    if (last.section) a.append(el('span', { class: 'small muted' }, sectionTitle(last.section)));
    this.replaceChildren(a);
  }
}

class ApPathProgress extends Live {
  static observedAttributes = ['entities'];
  attributeChangedCallback() {
    if (this.isConnected) void this.update();
  }
  async render() {
    const ids = (this.getAttribute('entities') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    if (!ids.length) return;
    const read = entitiesRead(await getAll('readProgress'));
    const inReview = new Set((await getAll('cards')).map((c) => c.entity));
    const nRead = ids.filter((id) => read.has(id)).length;
    const text = fmt(t('pathProgress'), { read: nRead, total: ids.length, reviewed: ids.filter((id) => inReview.has(id)).length });
    const bar = el('progress', { max: String(ids.length), value: String(nRead), 'aria-hidden': 'true' });
    this.replaceChildren(el('span', { class: 'small' }, text), bar);
  }
}

class ApDueCount extends Live {
  async render() {
    const n = dueCount(await getAll('cards'));
    this.textContent = n ? fmt(t('hubDue'), { n }) : t('hubNothingDue');
  }
}

class ApExportReminder extends Live {
  async render() {
    const due = reminderDue(Date.now(), {
      lastExport: await getSetting<number>('lastExport'),
      firstUse: await getSetting<number>('firstUse'),
      dismissed: await getSetting<number>('reminderDismissed'),
      hasData: await hasData(),
    });
    if (!due) return void this.replaceChildren();
    const box = el('div', { class: 'notice export-reminder', role: 'note' });
    const p = el('p', {}, t('reminder'));
    const actions = el('p', { class: 'reminder-actions' });
    const go = el('a', { class: 'btn btn-small btn-primary', href: langPath(lang(), 'me/data/') }, t('export'));
    const later = el('button', { type: 'button', class: 'btn btn-small' }, t('reminderLater'));
    later.addEventListener('click', () => void setSetting('reminderDismissed', Date.now()));
    actions.append(go, ' ', later);
    box.append(p, actions);
    this.replaceChildren(box);
  }
}

const define = (name: string, c: CustomElementConstructor) => customElements.get(name) ?? customElements.define(name, c);
define('ap-recent', ApRecent);
define('ap-resume', ApResume);
define('ap-path-progress', ApPathProgress);
define('ap-due-count', ApDueCount);
define('ap-export-reminder', ApExportReminder);
