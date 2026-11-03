/** FSRS review queue (/[lang]/study/review/). No streaks, no guilt: just today's cards. */
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { Lang } from '../i18n/index.ts';
import { fmt } from '../i18n/index.ts';
import { tS } from '../i18n/study.ts';
import { getAll, getSetting, setSetting, put, requestPersistOnce } from '../lib/db.ts';
import { buildQueue, rate, previewIntervals, Rating, State, type CardRecord, type Grade } from '../lib/srs.ts';
import { loadIndex, loadCards, useLoad, entityHref, interval, param, type StudyCard, type StudyIndex } from './client.ts';
import { CardFace } from './CardFace.tsx';

type Props = { lang: Lang };
const GRADES: { g: Grade; key: 'again' | 'hard' | 'good' | 'easy' }[] = [
  { g: Rating.Again, key: 'again' },
  { g: Rating.Hard, key: 'hard' },
  { g: Rating.Good, key: 'good' },
  { g: Rating.Easy, key: 'easy' },
];

type Loaded = { index: StudyIndex; scope: string; newPerDay: number; state: Map<string, CardRecord>; introducedToday: number; dbOk: boolean };

async function load(lang: Lang): Promise<Loaded> {
  const index = await loadIndex(lang);
  let dbOk = true;
  let scope = param('module') ?? 'all';
  let newPerDay = 15;
  const state = new Map<string, CardRecord>();
  let introducedToday = 0;
  try {
    scope = param('module') ?? (await getSetting<string>('reviewScope')) ?? 'all';
    newPerDay = (await getSetting<number>('newPerDay')) ?? 15;
    for (const r of await getAll('cards')) state.set(r.id, r);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    introducedToday = (await getAll('reviewLog')).filter((l) => l.at >= today.getTime() && l.state === State.New).length;
  } catch {
    dbOk = false;
  }
  if (scope !== 'all' && !index.modules.some((m) => m.id === scope)) scope = 'all';
  return { index, scope, newPerDay, state, introducedToday, dbOk };
}

export default function Review({ lang }: Props) {
  const t = (k: Parameters<typeof tS>[1]) => tS(lang, k);
  const base = useLoad(() => load(lang));
  const cram = param('cram') === '1';
  const [scope, setScope] = useState<string | undefined>();
  const [newPerDay, setNewPerDay] = useState<number | undefined>();
  const activeScope = scope ?? base.data?.scope ?? 'all';
  const modules = useMemo(
    () => (base.data ? (activeScope === 'all' ? base.data.index.modules.map((m) => m.id) : [activeScope]) : []),
    [base.data, activeScope],
  );
  const cards = useLoad(() => (modules.length ? loadCards(lang, modules) : Promise.resolve([])), [modules.join(',')]);

  if (base.loading) return <p aria-live="polite">{t('loading')}</p>;
  if (!base.data || base.data.index.modules.length === 0) return <p class="empty-state">{t('noContent')}</p>;
  const { index, dbOk } = base.data;
  const npd = newPerDay ?? base.data.newPerDay;

  return (
    <div class="study-tool">
      {!dbOk && <p class="notice notice-caution">{t('storageError')}</p>}
      <div class="tool-controls">
        <label>
          <span>{t('scope')}</span>
          <select
            value={activeScope}
            onChange={(e) => {
              const v = (e.target as HTMLSelectElement).value;
              setScope(v);
              if (!cram) setSetting('reviewScope', v).catch(() => {});
            }}
          >
            <option value="all">{t('allModules')}</option>
            {index.modules.map((m) => (
              <option value={m.id}>
                {m.id.toUpperCase()} · {m.label}
              </option>
            ))}
          </select>
        </label>
        {!cram && (
          <label>
            <span>{t('newPerDay')}</span>
            <input
              type="number"
              min={0}
              max={200}
              value={npd}
              onChange={(e) => {
                const v = Math.max(0, Math.min(200, Number((e.target as HTMLInputElement).value) || 0));
                setNewPerDay(v);
                setSetting('newPerDay', v).catch(() => {});
              }}
            />
          </label>
        )}
      </div>
      {cram && <p class="notice">{t('cramIntro')}</p>}
      {cards.loading ? (
        <p aria-live="polite">{t('loading')}</p>
      ) : (
        <Session
          key={`${activeScope}:${npd}:${cards.data?.length ?? 0}`}
          lang={lang}
          cards={cram ? (cards.data ?? []).filter((c) => c.kind === 'cloze') : (cards.data ?? [])}
          index={index}
          state={base.data.state}
          newLimit={npd - base.data.introducedToday}
          cram={cram}
          dbOk={dbOk}
        />
      )}
    </div>
  );
}

function Session(props: {
  lang: Lang;
  cards: StudyCard[];
  index: StudyIndex;
  state: Map<string, CardRecord>;
  newLimit: number;
  cram: boolean;
  dbOk: boolean;
}) {
  const { lang, index, state, cram, dbOk } = props;
  const t = (k: Parameters<typeof tS>[1]) => tS(lang, k);
  const initial = useMemo(() => {
    if (cram) return props.cards;
    const q = buildQueue({ cards: props.cards, state, now: new Date(), newLimit: props.newLimit });
    return [...q.due, ...q.news];
  }, [props.cards]);
  const counts = useMemo(() => {
    if (cram) return { due: 0, news: initial.length };
    const due = initial.filter((c) => state.get(c.id) && state.get(c.id)!.fsrs.state !== State.New).length;
    return { due, news: initial.length - due };
  }, [initial]);
  const [queue, setQueue] = useState(initial);
  const [pos, setPos] = useState(0);
  const [shown, setShown] = useState(false);
  const [done, setDone] = useState(0);
  const [live, setLive] = useState('');
  const revealRef = useRef<HTMLButtonElement>(null);
  const busy = useRef(false);
  const answerRef = useRef<HTMLDivElement>(null);
  const card = queue[pos];
  const name = card ? (index.entities.find((e) => e.id === card.entity)?.name ?? card.entity) : '';
  const intervals = useMemo(() => (card && !cram ? previewIntervals(state.get(card.id), new Date()) : undefined), [card, shown]);

  async function grade(g: Grade) {
    // One rating per card: fast or repeated key presses must not rate the same card twice.
    if (!card || busy.current) return;
    busy.current = true;
    if (!cram && dbOk) {
      const { record, log } = rate(state.get(card.id), card, g, new Date());
      state.set(card.id, record);
      try {
        await put('cards', record);
        await put('reviewLog', log);
        await requestPersistOnce();
      } catch {
        /* storage failed: the session continues, progress is not saved */
      }
      // Learning steps due again today come back at the end of this session.
      if ((record.fsrs.state === State.Learning || record.fsrs.state === State.Relearning) && record.fsrs.due <= Date.now() + 30 * 60_000)
        setQueue((q) => [...q, card]);
    }
    setDone((n) => n + 1);
    setShown(false);
    setPos((p) => p + 1);
  }
  useEffect(() => {
    busy.current = false;
  }, [pos]);

  async function forget() {
    if (!card || !dbOk) return;
    const now = Date.now();
    await put('errors', { id: `card:${card.id}`, entity: card.entity, card: card.id, updated: now }).catch(() => {});
    setLive(t('addedToErrors'));
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey || (e.target as HTMLElement).closest('input, select, textarea')) return;
      if (!shown && (e.key === ' ' || e.key === 'Enter') && (e.target as HTMLElement).tagName !== 'BUTTON') {
        e.preventDefault();
        setShown(true);
      } else if (shown && ['1', '2', '3', '4'].includes(e.key)) {
        e.preventDefault();
        void grade(Number(e.key) as Grade);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  useEffect(() => {
    if (shown) answerRef.current?.focus();
    else if (pos > 0) revealRef.current?.focus();
  }, [shown, pos]);

  if (!initial.length) return <p class="empty-state">{t('emptyQueue')}</p>;
  if (!card)
    return (
      <section class="card done-card" aria-live="polite">
        <h2>{t('doneTitle')}</h2>
        <p>{fmt(t('doneBody'), { n: done })}</p>
      </section>
    );

  return (
    <section class="review" aria-labelledby="review-card-title">
      <p class="small muted">
        {fmt(t('queueSummary'), { due: counts.due, new: counts.news })} · {fmt(t('cardOf'), { i: Math.min(pos + 1, queue.length), n: queue.length })}
      </p>
      <article class="card flashcard">
        <h2 id="review-card-title" class="kicker">
          {t(card.kind === 'cloze' ? 'kindCloze' : card.kind === 'qa' ? 'kindQa' : 'kindOcclusion')} · {name}
        </h2>
        <CardFace lang={lang} card={card} side="front" />
        {shown ? (
          <div class="answer" ref={answerRef} tabIndex={-1}>
            <CardFace lang={lang} card={card} side="back" />
            <p class="small">
              <a href={entityHref(lang, card.entity, card.section)}>{t('reviewThis')} →</a>
            </p>
          </div>
        ) : (
          <button type="button" class="btn btn-primary" ref={revealRef} onClick={() => setShown(true)}>
            {t('reveal')} <kbd>{t('revealKey')}</kbd>
          </button>
        )}
      </article>
      {shown && (
        <div class="rating" role="group" aria-label={t('rateLabel')}>
          {GRADES.map(({ g, key }, i) => (
            <button type="button" class={`btn rate-${key}`} onClick={() => void grade(g)}>
              <span>
                <kbd>{i + 1}</kbd> {t(key)}
              </span>
              {intervals && <span class="small muted">{fmt(t('nextIn'), { t: interval(lang, intervals[g]) })}</span>}
            </button>
          ))}
        </div>
      )}
      <p class="small muted">{t('shortcuts')}</p>
      {dbOk && !cram && (
        <p>
          <button type="button" class="btn btn-small" onClick={() => void forget()}>
            {t('forgetThis')}
          </button>
        </p>
      )}
      <p class="visually-hidden" aria-live="polite">
        {live}
      </p>
    </section>
  );
}
