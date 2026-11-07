/** Export / import, storage meter and persistence status (/[lang]/me/data/). */
import { useEffect, useState } from 'preact/hooks';
import type { Lang } from '../i18n/index.ts';
import { fmt, formatDate } from '../i18n/index.ts';
import { tS } from '../i18n/study.ts';
import { exportAll, importFile, getSetting } from '../lib/db.ts';
import { checkExport } from '../lib/import-check.ts';

const size = (lang: Lang, bytes: number) =>
  new Intl.NumberFormat(lang === 'it' ? 'it-IT' : 'en-GB', { style: 'unit', unit: bytes > 1e9 ? 'gigabyte' : 'megabyte', maximumFractionDigits: 1 }).format(
    bytes > 1e9 ? bytes / 1e9 : bytes / 1e6,
  );

export default function DataManager({ lang }: { lang: Lang }) {
  const t = (k: Parameters<typeof tS>[1]) => tS(lang, k);
  const [lastExport, setLastExport] = useState<number | undefined>();
  const [estimate, setEstimate] = useState<StorageEstimate | undefined>();
  const [persisted, setPersisted] = useState<boolean | undefined>();
  const [msg, setMsg] = useState('');
  const [failed, setFailed] = useState(false);

  const refresh = async () => {
    try {
      setLastExport(await getSetting<number>('lastExport'));
    } catch {
      setFailed(true);
    }
    setEstimate(await navigator.storage?.estimate?.().catch(() => undefined));
    setPersisted(await navigator.storage?.persisted?.().catch(() => undefined));
  };
  useEffect(() => void refresh(), []);

  async function doExport() {
    const file = await exportAll();
    const blob = new Blob([JSON.stringify(file, null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `atlante-patologia-backup-${file.exportedAt.slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    await refresh();
  }

  async function doImport(e: Event) {
    const input = e.target as HTMLInputElement;
    const f = input.files?.[0];
    if (!f) return;
    let raw: unknown;
    try {
      raw = JSON.parse(await f.text());
    } catch {
      return setMsg(t('importErrorFormat'));
    }
    const check = await checkExport(raw);
    if (!check.ok)
      return setMsg(t(check.error === 'version' ? 'importErrorVersion' : check.error === 'checksum' ? 'importErrorChecksum' : 'importErrorFormat'));
    const done = fmt(t('importDone'), { n: await importFile(check.file) });
    setMsg(check.skipped ? `${done} ${fmt(t('importSkipped'), { n: check.skipped })}` : done);
    input.value = '';
    await refresh();
  }

  if (failed) return <p class="notice notice-caution">{t('storageError')}</p>;
  return (
    <div class="study-tool data-manager">
      <section class="card" aria-labelledby="exp-title">
        <h2 id="exp-title">{t('export')}</h2>
        <p class="small">{lastExport ? fmt(t('lastExport'), { date: formatDate(lang, new Date(lastExport)) }) : t('neverExported')}</p>
        <button type="button" class="btn btn-primary" onClick={() => void doExport()}>
          {t('export')}
        </button>
      </section>
      <section class="card" aria-labelledby="imp-title">
        <h2 id="imp-title">{t('import')}</h2>
        <p class="small">{t('importHelp')}</p>
        <label class="file-input">
          <span class="visually-hidden">{t('import')}</span>
          <input type="file" accept="application/json,.json" onChange={(e) => void doImport(e)} />
        </label>
        <p role="status" aria-live="polite">
          {msg}
        </p>
      </section>
      <section class="card" aria-labelledby="sto-title">
        <h2 id="sto-title">{t('storage')}</h2>
        {estimate?.usage !== undefined && estimate.quota !== undefined && (
          <p>{fmt(t('storageValue'), { used: size(lang, estimate.usage), quota: size(lang, estimate.quota) })}</p>
        )}
        <p class="small">{persisted ? t('persisted') : t('notPersisted')}</p>
      </section>
    </div>
  );
}
