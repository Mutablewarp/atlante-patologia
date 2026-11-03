/** Image training (/[lang]/study/images/): spot the diagnosis, gross/micro pairs, look-alikes. */
import { useMemo, useState } from 'preact/hooks';
import type { Lang } from '../i18n/index.ts';
import { fmt } from '../i18n/index.ts';
import { tS } from '../i18n/study.ts';
import { shuffle } from '../lib/quiz.ts';
import { entityHref } from './client.ts';
import { Figure } from './CardFace.tsx';
import Quiz from './Quiz.tsx';

export type Img = { src: string; width: number; height: number; alt: string };
export type Pair = { entity: string; name: string; gross: Img; micro: Img };
export type LookAlike = { entity: string; name: string; image: Img; other: { entity: string; name: string } };
type T = (k: Parameters<typeof tS>[1]) => string;
type Mode = 'spot' | 'pairs' | 'look';

export default function ImageTraining({ lang, pairs, lookalikes, hasSpot }: { lang: Lang; pairs: Pair[]; lookalikes: LookAlike[]; hasSpot: boolean }) {
  const t: T = (k) => tS(lang, k);
  const [mode, setMode] = useState<Mode>(hasSpot ? 'spot' : pairs.length ? 'pairs' : 'look');
  const tabs: [Mode, 'spotTitle' | 'pairsTitle' | 'lookTitle'][] = [
    ['spot', 'spotTitle'],
    ['pairs', 'pairsTitle'],
    ['look', 'lookTitle'],
  ];
  return (
    <div class="study-tool">
      <div class="segmented" role="group" aria-label={t('mode')}>
        {tabs.map(([m, k]) => (
          <button type="button" aria-pressed={mode === m} onClick={() => setMode(m)}>
            {t(k)}
          </button>
        ))}
      </div>
      {mode === 'spot' && (hasSpot ? <Quiz lang={lang} filter="image-spot" /> : <p class="empty-state">{t('noImages')}</p>)}
      {mode === 'pairs' && <Pairs lang={lang} t={t} pairs={pairs} />}
      {mode === 'look' && <LookAlikes lang={lang} t={t} items={lookalikes} />}
    </div>
  );
}

function Feedback({ lang, t, ok, entity, name }: { lang: Lang; t: T; ok: boolean; entity: string; name: string }) {
  return (
    <div role="status">
      <p class={`verdict ${ok ? 'is-correct' : 'is-wrong'}`}>{ok ? `✓ ${t('correct')}` : `✗ ${t('wrong')}`}</p>
      <p class="small">
        <a href={entityHref(lang, entity)}>
          {t('reviewThis')}: {name} →
        </a>
      </p>
    </div>
  );
}

function Pairs({ lang, t, pairs }: { lang: Lang; t: T; pairs: Pair[] }) {
  const order = useMemo(() => shuffle(pairs), [pairs]);
  const [i, setI] = useState(0);
  const [pick, setPick] = useState<string | null>(null);
  const item = order[i % Math.max(1, order.length)];
  const choices = useMemo(
    () => (item ? shuffle([item, ...shuffle(order.filter((p) => p.entity !== item.entity)).slice(0, 3)]) : []),
    [item],
  );
  if (!item) return <p class="empty-state">{t('noImages')}</p>;
  return (
    <section class="drill" aria-labelledby="pairs-q">
      <h2 id="pairs-q" class="kicker">
        {t('pairsPrompt')}
      </h2>
      <Figure img={{ ...item.gross, shapes: [], target: 0 }} />
      <ul class="image-choices">
        {choices.map((c, n) => (
          <li>
            <button
              type="button"
              class={`image-choice${pick ? (c.entity === item.entity ? ' is-correct' : c.entity === pick ? ' is-wrong' : '') : ''}`}
              aria-pressed={pick === c.entity}
              disabled={!!pick}
              onClick={() => setPick(c.entity)}
            >
              <span class="small">{fmt(t('choice'), { n: n + 1 })}</span>
              <img src={c.micro.src} width={c.micro.width} height={c.micro.height} alt={c.micro.alt} loading="lazy" />
            </button>
          </li>
        ))}
      </ul>
      {pick && (
        <>
          <Feedback lang={lang} t={t} ok={pick === item.entity} entity={item.entity} name={item.name} />
          <button type="button" class="btn btn-primary" onClick={() => (setPick(null), setI(i + 1))}>
            {t('next')}
          </button>
        </>
      )}
    </section>
  );
}

function LookAlikes({ lang, t, items }: { lang: Lang; t: T; items: LookAlike[] }) {
  const order = useMemo(() => shuffle(items), [items]);
  const [i, setI] = useState(0);
  const [pick, setPick] = useState<string | null>(null);
  const item = order[i % Math.max(1, order.length)];
  const options = useMemo(() => (item ? shuffle([{ entity: item.entity, name: item.name }, item.other]) : []), [item]);
  if (!item) return <p class="empty-state">{t('noImages')}</p>;
  return (
    <section class="drill" aria-labelledby="look-q">
      <h2 id="look-q" class="kicker">
        {t('lookPrompt')}
      </h2>
      <Figure img={{ ...item.image, shapes: [], target: 0 }} />
      <div class="choice-row" role="group" aria-labelledby="look-q">
        {options.map((o) => (
          <button
            type="button"
            class={`btn${pick ? (o.entity === item.entity ? ' is-correct' : o.entity === pick ? ' is-wrong' : '') : ''}`}
            aria-pressed={pick === o.entity}
            disabled={!!pick}
            onClick={() => setPick(o.entity)}
          >
            {o.name}
          </button>
        ))}
      </div>
      {pick && (
        <>
          <Feedback lang={lang} t={t} ok={pick === item.entity} entity={item.entity} name={item.name} />
          <button type="button" class="btn btn-primary" onClick={() => (setPick(null), setI(i + 1))}>
            {t('next')}
          </button>
        </>
      )}
    </section>
  );
}
