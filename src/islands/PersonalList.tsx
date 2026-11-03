/** Bookmarks, notes + highlights, error log (/[lang]/me/{bookmarks,notes,errors}/). */
import { useEffect, useState } from 'preact/hooks';
import type { Lang } from '../i18n/index.ts';
import { tS } from '../i18n/study.ts';
import { getAll, remove, type StoreName } from '../lib/db.ts';
import { SECTIONS, QUICK_CHECK } from '../i18n/sections.ts';
import { loadIndex, entityHref } from './client.ts';

type Kind = 'bookmarks' | 'notes' | 'errors';
type Row = { store: StoreName; id: string; entity: string; text?: string; section?: string; updated: number };

async function load(kind: Kind): Promise<Row[]> {
  if (kind === 'bookmarks') return (await getAll('bookmarks')).map((r) => ({ store: 'bookmarks', id: r.id, entity: r.id, updated: r.updated }));
  if (kind === 'errors') return (await getAll('errors')).map((r) => ({ store: 'errors', id: r.id, entity: r.entity, updated: r.updated }));
  const notes = (await getAll('notes')).map((r): Row => ({ store: 'notes', id: r.id, entity: r.id, text: r.text, updated: r.updated }));
  const hl = (await getAll('highlights')).map((r): Row => ({ store: 'highlights', id: r.id, entity: r.entity, text: r.text, section: r.section, updated: r.updated }));
  return [...notes, ...hl];
}

export default function PersonalList({ lang, kind }: { lang: Lang; kind: Kind }) {
  const t = (k: Parameters<typeof tS>[1]) => tS(lang, k);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [names, setNames] = useState(new Map<string, string>());
  const [failed, setFailed] = useState(false);
  const refresh = () =>
    load(kind)
      .then((r) => setRows(r.sort((a, b) => b.updated - a.updated)))
      .catch(() => setFailed(true));
  useEffect(() => {
    void refresh();
    loadIndex(lang)
      .then((i) => setNames(new Map(i.entities.map((e) => [e.id, e.name]))))
      .catch(() => {});
  }, []);

  if (failed) return <p class="notice notice-caution">{t('storageError')}</p>;
  if (!rows) return <p aria-live="polite">{t('loading')}</p>;
  if (!rows.length) return <p class="empty-state">{t(`${kind}Empty` as 'notesEmpty')}</p>;
  const name = (id: string) => names.get(id) ?? id;
  const sectionName = (id?: string) => [...SECTIONS, QUICK_CHECK].find((s) => s.id === id)?.short[lang];
  const del = async (r: Row) => {
    await remove(r.store, r.id);
    await refresh();
  };

  return (
    <ul class="personal-list">
      {rows.map((r) => (
        <li class="card">
          <p class="personal-head">
            <a href={entityHref(lang, r.entity, r.section)}>{name(r.entity)}</a>
            {r.store === 'highlights' && <span class="badge">{t('highlights')} · {sectionName(r.section)}</span>}
            {r.store === 'notes' && <span class="badge">{t('note')}</span>}
          </p>
          {r.text && (r.store === 'highlights' ? <blockquote>{r.text}</blockquote> : <p class="note-text">{r.text}</p>)}
          <button type="button" class="btn btn-small" onClick={() => void del(r)} aria-label={`${t('delete')}: ${name(r.entity)}`}>
            {t('delete')}
          </button>
        </li>
      ))}
    </ul>
  );
}
