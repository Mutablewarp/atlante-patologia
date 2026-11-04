/**
 * Oral exam simulator (/[lang]/study/oral/): three possible exam questions,
 * one at a time. Answer aloud → predict a score → check the focus sections →
 * self-assess with a four-criterion rubric. Sessions stay on this device.
 */
import { useEffect, useRef, useState } from 'preact/hooks';
import type { Lang } from '../i18n/index.ts';
import { fmt, formatDate, LOCALE_TAG } from '../i18n/index.ts';
import { tS } from '../i18n/study.ts';
import { getAll, put } from '../lib/db.ts';
import { drawQuestions, isOralItem, oralCalibration, rubricMean, RUBRIC, SCORES, type OralItem, type OralQuestion, type Rubric, type Score } from '../lib/oral.ts';
import { loadOral, useLoad } from './client.ts';

type T = (k: Parameters<typeof tS>[1]) => string;
type Run = { id: string; at: number; questions: OralQuestion[]; seconds?: number };
const BIAS = { tooFew: 'oralBiasTooFew', over: 'oralBiasOver', under: 'oralBiasUnder', calibrated: 'oralBiasCalibrated' } as const;

const one = (lang: Lang, n: number) => new Intl.NumberFormat(LOCALE_TAG[lang], { maximumFractionDigits: 1 }).format(n);

async function sessions() {
  try {
    // checkExport validates oral rows on import; this guard also covers rows written before that check.
    return (await getAll('oralSessions'))
      .map((s) => ({ ...s, items: Array.isArray(s.items) ? s.items.filter(isOralItem) : [] }))
      .filter((s) => typeof s.at === 'number' && s.items.length > 0)
      .sort((a, b) => b.at - a.at);
  } catch {
    return []; // no storage: the simulator still works, nothing is remembered
  }
}

export default function OralExam({ lang }: { lang: Lang }) {
  const t: T = (k) => tS(lang, k);
  const pool = useLoad(() => loadOral(lang));
  const [run, setRun] = useState<Run | null>(null);
  const [restarted, setRestarted] = useState(false);
  const history = useLoad(sessions, [run]);
  // The page builds the empty state itself when there are no questions; this covers a failed fetch.
  if (!pool.loading && !pool.data?.length) return <p class="empty-state">{t('oralNoContent')}</p>;
  if (run)
    return (
      <Runner
        key={run.id}
        lang={lang}
        t={t}
        run={run}
        onRestart={() => {
          setRun(null);
          setRestarted(true);
        }}
      />
    );
  // While the pool loads, the same form is shown (start disabled), so nothing shifts on hydration.
  return (
    <div class="study-tool">
      <Setup
        t={t}
        ready={!!pool.data}
        focus={restarted}
        onStart={(seconds) => setRun({ id: `oral@${Date.now()}`, at: Date.now(), questions: drawQuestions(pool.data!), seconds })}
      />
      <History lang={lang} t={t} list={history.loading ? undefined : (history.data ?? [])} />
    </div>
  );
}

function Setup({ t, ready, focus, onStart }: { t: T; ready: boolean; focus: boolean; onStart: (seconds?: number) => void }) {
  const [timer, setTimer] = useState(false);
  const [minutes, setMinutes] = useState(5);
  const first = useRef<HTMLInputElement>(null);
  // After "Start again" the results are gone: put focus on the first control instead of <body>.
  useEffect(() => {
    if (focus) first.current?.focus();
  }, []);
  return (
    <form
      class="card tool-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (ready) onStart(timer ? Math.round(minutes * 60) : undefined);
      }}
    >
      <label class="checkbox">
        <input ref={first} type="checkbox" checked={timer} onChange={(e) => setTimer((e.target as HTMLInputElement).checked)} />
        <span>{t('useTimer')}</span>
      </label>
      {timer && (
        <label>
          <span>{t('minutesPerAnswer')}</span>
          <input type="number" min={1} max={20} value={minutes} onChange={(e) => setMinutes(Number((e.target as HTMLInputElement).value) || 5)} />
        </label>
      )}
      <p>
        <button type="submit" class="btn btn-primary" aria-disabled={ready ? undefined : 'true'}>
          {ready ? t('start') : t('loading')}
        </button>
      </p>
    </form>
  );
}

function Scores(props: { t: T; name: string; legend: string; help?: string; value?: Score; onChange: (s: Score) => void }) {
  return (
    <fieldset class="score-scale">
      <legend>{props.legend}</legend>
      {props.help && <p class="small muted">{props.help}</p>}
      <div class="score-options">
        {SCORES.map((s) => (
          <label class="radio">
            <input type="radio" name={props.name} value={s} checked={props.value === s} onChange={() => props.onChange(s)} />
            <span>{props.t(`score${s}`)}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function Runner({ lang, t, run, onRestart }: { lang: Lang; t: T; run: Run; onRestart: () => void }) {
  const [pos, setPos] = useState(0);
  const [phase, setPhase] = useState<'answer' | 'predict' | 'assess' | 'done'>('answer');
  const [items, setItems] = useState<OralItem[]>([]);
  const [predicted, setPredicted] = useState<Score | undefined>();
  const [rubric, setRubric] = useState<Partial<Rubric>>({});
  const [left, setLeft] = useState(run.seconds ?? 0);
  const started = useRef(Date.now());
  const spent = useRef(0);
  const headRef = useRef<HTMLHeadingElement>(null);
  const saving = useRef(false);
  const [busy, setBusy] = useState(false);
  const q = run.questions[pos]!;

  useEffect(() => {
    if (!run.seconds || phase !== 'answer') return;
    const h = setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(h);
  }, [phase, pos]);
  useEffect(() => headRef.current?.focus(), [pos, phase]);

  function answered() {
    spent.current = Math.round((Date.now() - started.current) / 1000);
    setPhase('predict');
  }
  async function save() {
    // One record per answer: a second activation while the write is pending is ignored.
    if (saving.current) return;
    saving.current = true;
    setBusy(true);
    const item: OralItem = { question: q.id, entity: q.entity, text: q.text, predicted: predicted!, rubric: rubric as Rubric, seconds: spent.current };
    const all = [...items, item];
    setItems(all);
    try {
      await put('oralSessions', { id: run.id, at: run.at, items: all, updated: Date.now() });
    } catch {
      /* storage unavailable: the session continues, it is not remembered */
    }
    saving.current = false;
    setBusy(false);
    if (pos + 1 >= run.questions.length) return setPhase('done');
    setPos(pos + 1);
    setPhase('answer');
    setPredicted(undefined);
    setRubric({});
    setLeft(run.seconds ?? 0);
    started.current = Date.now();
  }

  if (phase === 'done') {
    const c = oralCalibration(items);
    return (
      <section class="card oral-results" aria-labelledby="oral-done-title">
        <h2 id="oral-done-title" tabIndex={-1} ref={headRef}>
          {t('oralDone')}
        </h2>
        <div class="table-scroll" tabIndex={0} role="region" aria-labelledby="oral-done-title">
          <table>
            <thead>
              <tr>
                <th scope="col">{t('colQuestion')}</th>
                <th scope="col">{t('colPredicted')}</th>
                <th scope="col">{t('colAssessed')}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((i) => (
                <tr>
                  <th scope="row">{i.text}</th>
                  <td>{i.predicted}</td>
                  <td>{one(lang, rubricMean(i.rubric))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>{fmt(t('oralAverages'), { p: one(lang, c.predicted), a: one(lang, c.assessed), n: c.n })}</p>
        <p class="notice">{t(BIAS[c.bias])}</p>
        <p>
          <button type="button" class="btn btn-primary" onClick={onRestart}>
            {t('restart')}
          </button>
        </p>
      </section>
    );
  }

  const title = fmt(t('questionOf'), { i: pos + 1, n: run.questions.length });
  return (
    <section class="card oral" aria-labelledby="oral-q-title">
      <div class="quiz-bar">
        <h2 id="oral-q-title" class="kicker" tabIndex={-1} ref={headRef}>
          {title}
        </h2>
        {run.seconds && phase === 'answer' && (
          <span role="timer">{fmt(t('timeLeft'), { t: `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}` })}</span>
        )}
      </div>
      <p class="oral-question">{q.text}</p>
      <p class="small muted">{fmt(t('level'), { level: t(`level${q.level}`) })}</p>

      {phase === 'answer' && (
        <>
          <p>{t('answerAloud')}</p>
          {/* Live region present from the start of the answer, so "time is up" is announced (WCAG 4.1.3). */}
          <p role="status" class={run.seconds && left === 0 ? 'notice' : 'visually-hidden'}>
            {run.seconds && left === 0 ? t('oralTimeUp') : ''}
          </p>
          <button type="button" class="btn btn-primary" onClick={answered}>
            {t('doneAnswering')}
          </button>
        </>
      )}

      {phase === 'predict' && (
        <>
          <Scores t={t} name={`pred-${pos}`} legend={t('predictLegend')} help={t('predictHelp')} value={predicted} onChange={setPredicted} />
          <button type="button" class="btn btn-primary" disabled={!predicted} onClick={() => setPhase('assess')}>
            {t('toCheck')}
          </button>
        </>
      )}

      {phase === 'assess' && (
        <>
          <p class="oral-check">
            <strong>{t('checkAgainst')}</strong> {q.name}
          </p>
          <ul class="oral-focus">
            {q.focus.map((f) => (
              <li>
                <a href={f.href} target="_blank" rel="noopener">
                  {f.label}
                </a>{' '}
                <span class="small muted">{t('newTab')}</span>
              </li>
            ))}
          </ul>
          <h3>{t('rubricTitle')}</h3>
          <p class="small muted">{t('rubricHelp')}</p>
          {RUBRIC.map((c) => (
            <Scores t={t} name={`rub-${pos}-${c}`} legend={t(c)} value={rubric[c]} onChange={(s) => setRubric((r) => ({ ...r, [c]: s }))} />
          ))}
          <button type="button" class="btn btn-primary" disabled={busy || RUBRIC.some((c) => !rubric[c])} onClick={() => void save()}>
            {pos + 1 >= run.questions.length ? t('finish') : t('saveNext')}
          </button>
        </>
      )}
    </section>
  );
}

function History({ lang, t, list }: { lang: Lang; t: T; list?: { id: string; at: number; items: OralItem[] }[] }) {
  const c = oralCalibration((list ?? []).flatMap((s) => s.items));
  return (
    <section aria-labelledby="oral-history-title">
      <h2 id="oral-history-title">{t('historyTitle')}</h2>
      {/* While reloading, never claim that nothing is saved. */}
      {!list ? (
        <p class="muted">{t('loading')}</p>
      ) : list.length ? (
        <>
          <ul class="oral-history">
            {list.slice(0, 10).map((s) => (
              <li>
                {fmt(t('historyRow'), {
                  date: formatDate(lang, new Date(s.at)),
                  n: s.items.length,
                  a: s.items.length ? one(lang, s.items.reduce((n, i) => n + rubricMean(i.rubric), 0) / s.items.length) : '–',
                })}
              </li>
            ))}
          </ul>
          <p>{fmt(t('oralAverages'), { p: one(lang, c.predicted), a: one(lang, c.assessed), n: c.n })}</p>
          <p class="notice">{t(BIAS[c.bias])}</p>
        </>
      ) : (
        <p class="muted">{t('historyEmpty')}</p>
      )}
    </section>
  );
}
