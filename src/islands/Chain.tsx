/** Chain trainer (/[lang]/study/chain/): pathology → sign → lab, from meta.chain. */
import { useMemo, useState } from 'preact/hooks';
import type { Lang } from '../i18n/index.ts';
import { fmt } from '../i18n/index.ts';
import { tS } from '../i18n/study.ts';
import { shuffle } from '../lib/quiz.ts';
import { entityHref } from './client.ts';

export type ChainLink = { entity: string; name: string; pathology: string; sign: string; lab: string };

function optionsFor(correct: string, pool: string[]) {
  return shuffle([correct, ...shuffle([...new Set(pool)].filter((x) => x !== correct)).slice(0, 3)]);
}

export default function Chain({ lang, links }: { lang: Lang; links: ChainLink[] }) {
  const t = (k: Parameters<typeof tS>[1]) => tS(lang, k);
  const order = useMemo(() => shuffle(links), [links]);
  const [i, setI] = useState(0);
  const [sign, setSign] = useState<string | null>(null);
  const [lab, setLab] = useState<string | null>(null);
  const item = order[i % Math.max(1, order.length)];
  const signOpts = useMemo(() => (item ? optionsFor(item.sign, links.map((l) => l.sign)) : []), [item]);
  const labOpts = useMemo(() => (item ? optionsFor(item.lab, links.map((l) => l.lab)) : []), [item]);
  if (!item) return <p class="empty-state">{t('noContent')}</p>;

  const step = (label: string, opts: string[], right: string, pick: string | null, set: (v: string) => void, id: string) => (
    <fieldset class="options">
      <legend id={id}>{label}</legend>
      {opts.map((o) => (
        <div class={`option${pick ? (o === right ? ' is-correct' : o === pick ? ' is-wrong' : '') : ''}`}>
          <label class="radio">
            <input type="radio" name={id} checked={pick === o} disabled={!!pick} onChange={() => set(o)} />
            <span>{o}</span>
          </label>
        </div>
      ))}
      {pick && (
        <p class={`verdict ${pick === right ? 'is-correct' : 'is-wrong'}`} role="status">
          {pick === right ? `✓ ${t('correct')}` : `✗ ${t('wrong')}: ${right}`}
        </p>
      )}
    </fieldset>
  );

  return (
    <section class="drill card" aria-labelledby="chain-path">
      <p class="kicker">{t('chainPathology')}</p>
      <h2 id="chain-path">{item.pathology}</h2>
      {step(t('chainSign'), signOpts, item.sign, sign, setSign, `sign-${i}`)}
      {sign && step(t('chainLab'), labOpts, item.lab, lab, setLab, `lab-${i}`)}
      {lab && (
        <>
          <p role="status">{fmt(t('chainDone'), { right: Number(sign === item.sign) + Number(lab === item.lab), total: 2 })}</p>
          <p class="small">
            <a href={entityHref(lang, item.entity)}>
              {t('reviewThis')}: {item.name} →
            </a>
          </p>
          <button type="button" class="btn btn-primary" onClick={() => (setSign(null), setLab(null), setI(i + 1))}>
            {t('next')}
          </button>
        </>
      )}
    </section>
  );
}
