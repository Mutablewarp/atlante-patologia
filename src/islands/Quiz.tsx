/** Quiz (/[lang]/study/quiz/?mode=topic|mixed|exam|weak&module=…&entity=…). */
import { useEffect, useRef, useState } from 'preact/hooks';
import type { Lang } from '../i18n/index.ts';
import { fmt } from '../i18n/index.ts';
import { tS } from '../i18n/study.ts';
import { getAll, put } from '../lib/db.ts';
import { shuffle, interleave, weakQuestions, type QuizQuestion, type Attempt } from '../lib/quiz.ts';
import { loadIndex, loadQuestions, useLoad, param, type StudyIndex } from './client.ts';
import { Figure } from './CardFace.tsx';

type Mode = 'topic' | 'mixed' | 'exam' | 'weak';
const MODES: Mode[] = ['topic', 'mixed', 'exam', 'weak'];
type Answer = { choice?: string; text?: string; grade?: 'right' | 'partial' | 'wrong' };
type T = (k: Parameters<typeof tS>[1]) => string;
type Run = { questions: QuizQuestion[]; mode: Mode; seconds?: number; freeRecall: boolean };

async function saveAttempt(q: QuizQuestion, correct: boolean, mode: Mode) {
  const at = Date.now();
  try {
    await put('quizAttempts', { id: `${q.id}@${at}`, question: q.id, entities: q.entities, module: q.module, correct, mode, at, updated: at });
  } catch {
    /* storage unavailable: the quiz still works */
  }
}

const isRight = (q: QuizQuestion, a: Answer | undefined) =>
  q.kind === 'short' ? a?.grade === 'right' : !!a?.choice && !!q.options.find((o) => o.id === a.choice)?.correct;

export default function Quiz({ lang, filter }: { lang: Lang; filter?: 'image-spot' }) {
  const t: T = (k) => tS(lang, k);
  const idx = useLoad(() => loadIndex(lang));
  const [run, setRun] = useState<Run | null>(null);
  if (idx.loading) return <p aria-live="polite">{t('loading')}</p>;
  const index = idx.data;
  const modules = (index?.modules ?? []).filter((m) => m.questions > 0);
  if (!index || !modules.length) return <p class="empty-state">{t('noContent')}</p>;
  if (run)
    return <Runner key={run.questions.map((q) => q.id).join()} lang={lang} t={t} {...run} index={index} onRestart={() => setRun(null)} />;
  return <Setup lang={lang} t={t} index={index} modules={modules.map((m) => m.id)} filter={filter} onStart={setRun} />;
}

function Setup(props: {
  lang: Lang;
  t: T;
  index: StudyIndex;
  modules: string[];
  filter?: 'image-spot';
  onStart: (r: Run) => void;
}) {
  const { lang, t, index, filter } = props;
  const initialMode = param('mode') as Mode | null;
  const entity = param('entity');
  const [mode, setMode] = useState<Mode>(filter ? 'mixed' : initialMode && MODES.includes(initialMode) ? initialMode : 'topic');
  const [module, setModule] = useState(param('module') ?? index.entities.find((e) => e.id === entity)?.module ?? props.modules[0]!);
  const [onlyEntity, setOnlyEntity] = useState(!!entity);
  const [count, setCount] = useState(10);
  const [perQ, setPerQ] = useState(1.5);
  const [freeRecall, setFreeRecall] = useState(false);
  const [msg, setMsg] = useState('');
  const entityName = entity ? index.entities.find((e) => e.id === entity)?.name : undefined;

  async function start(e: Event) {
    e.preventDefault();
    const scope = mode === 'topic' ? [module] : props.modules;
    let qs = await loadQuestions(lang, scope);
    if (filter) qs = qs.filter((q) => q.kind === filter);
    if (mode === 'topic' && onlyEntity && entity) qs = qs.filter((q) => q.entities.includes(entity));
    if (mode === 'weak') {
      let attempts: Attempt[] = [];
      try {
        attempts = await getAll('quizAttempts');
      } catch {
        /* no storage: no weak areas */
      }
      qs = weakQuestions(qs, attempts);
      if (!qs.length) return setMsg(t('noWeak'));
    }
    qs = mode === 'mixed' || mode === 'exam' ? interleave(shuffle(qs)) : shuffle(qs);
    qs = qs.slice(0, Math.max(1, count));
    if (!qs.length) return setMsg(t('noQuestions'));
    props.onStart({ questions: qs, mode, freeRecall: freeRecall && mode !== 'exam', seconds: mode === 'exam' ? Math.round(qs.length * perQ * 60) : undefined });
  }

  return (
    <form class="card tool-form" onSubmit={start}>
      {!filter && (
        <fieldset>
          <legend>{t('mode')}</legend>
          {MODES.map((m) => (
            <label class="radio">
              <input type="radio" name="mode" value={m} checked={mode === m} onChange={() => setMode(m)} />
              <span>
                <strong>{t(`mode${m[0]!.toUpperCase()}${m.slice(1)}` as 'modeTopic')}</strong>
                <span class="small muted"> — {t(`mode${m[0]!.toUpperCase()}${m.slice(1)}Help` as 'modeTopicHelp')}</span>
              </span>
            </label>
          ))}
        </fieldset>
      )}
      {mode === 'topic' && (
        <label>
          <span>{t('module')}</span>
          <select value={module} onChange={(e) => setModule((e.target as HTMLSelectElement).value)}>
            {props.modules.map((id) => (
              <option value={id}>
                {id.toUpperCase()} · {index.modules.find((m) => m.id === id)?.label}
              </option>
            ))}
          </select>
        </label>
      )}
      {mode === 'topic' && entityName && (
        <label class="checkbox">
          <input type="checkbox" checked={onlyEntity} onChange={(e) => setOnlyEntity((e.target as HTMLInputElement).checked)} />
          <span>{fmt(t('entityFilter'), { name: entityName })}</span>
        </label>
      )}
      <label>
        <span>{t('count')}</span>
        <input type="number" min={1} max={100} value={count} onChange={(e) => setCount(Number((e.target as HTMLInputElement).value) || 10)} />
      </label>
      {mode !== 'exam' && (
        <label class="checkbox">
          <input type="checkbox" checked={freeRecall} onChange={(e) => setFreeRecall((e.target as HTMLInputElement).checked)} />
          <span>{t('freeRecall')}</span>
        </label>
      )}
      {mode === 'exam' && (
        <label>
          <span>{t('minutesPerQ')}</span>
          <input type="number" min={0.5} max={10} step={0.5} value={perQ} onChange={(e) => setPerQ(Number((e.target as HTMLInputElement).value) || 1.5)} />
        </label>
      )}
      <p>
        <button type="submit" class="btn btn-primary">
          {t('start')}
        </button>
      </p>
      <p aria-live="polite" class="small">
        {msg}
      </p>
    </form>
  );
}

function Runner(props: Run & { lang: Lang; t: T; index: StudyIndex; onRestart: () => void }) {
  const { lang, t, questions, mode } = props;
  const exam = mode === 'exam';
  const [pos, setPos] = useState(0);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [checked, setChecked] = useState(false);
  const [finished, setFinished] = useState(false);
  const [left, setLeft] = useState(props.seconds ?? 0);
  const [paused, setPaused] = useState(false);
  const headRef = useRef<HTMLHeadingElement>(null);
  const q = questions[pos]!;
  const a = answers[q.id] ?? {};
  const setA = (patch: Answer) => setAnswers((all) => ({ ...all, [q.id]: { ...all[q.id], ...patch } }));

  useEffect(() => {
    if (!exam || paused || finished) return;
    const h = setInterval(() => setLeft((s) => s - 1), 1000);
    return () => clearInterval(h);
  }, [exam, paused, finished]);
  useEffect(() => {
    if (exam && left <= 0 && !finished) void finish();
  }, [left]);
  useEffect(() => headRef.current?.focus(), [pos, finished]);

  async function check() {
    setChecked(true);
    if (q.kind !== 'short') await saveAttempt(q, isRight(q, a), mode);
  }
  async function gradeShort(grade: Answer['grade']) {
    setA({ grade });
    setChecked(true);
    await saveAttempt(q, grade === 'right', mode);
  }
  async function finish() {
    if (exam) for (const x of questions) if (x.kind !== 'short' && answers[x.id]?.choice) await saveAttempt(x, isRight(x, answers[x.id]), mode);
    setFinished(true);
  }
  function next() {
    if (pos + 1 >= questions.length) return void finish();
    setChecked(false);
    setPos(pos + 1);
  }

  if (finished) {
    const graded = questions.filter((x) => x.kind !== 'short' || answers[x.id]?.grade);
    const right = graded.filter((x) => isRight(x, answers[x.id])).length;
    return (
      <section class="quiz-results" aria-labelledby="quiz-results-title">
        <h2 id="quiz-results-title" tabIndex={-1} ref={headRef}>
          {t('results')}
        </h2>
        {exam && left <= 0 && <p class="notice">{t('timeUp')}</p>}
        <p class="lede">{fmt(t('score'), { right, total: graded.length })}</p>
        <p class="small muted">{t('scoreNote')}</p>
        {exam && (
          <ol class="results-list">
            {questions.map((x) => (
              <li>
                <QuestionView
                  lang={lang}
                  t={t}
                  q={x}
                  a={answers[x.id] ?? {}}
                  reveal
                  freeRecall={false}
                  onGrade={
                    x.kind === 'short' && !answers[x.id]?.grade
                      ? (grade) => {
                          setAnswers((all) => ({ ...all, [x.id]: { ...all[x.id], grade } }));
                          void saveAttempt(x, grade === 'right', mode);
                        }
                      : undefined
                  }
                />
              </li>
            ))}
          </ol>
        )}
        <p>
          <button type="button" class="btn btn-primary" onClick={props.onRestart}>
            {t('restart')}
          </button>
        </p>
      </section>
    );
  }

  return (
    <section class="quiz" aria-labelledby="quiz-q-title">
      <div class="quiz-bar">
        <h2 id="quiz-q-title" class="kicker" tabIndex={-1} ref={headRef}>
          {fmt(t('questionOf'), { i: pos + 1, n: questions.length })}
        </h2>
        {exam && (
          <div class="timer">
            <span role="timer">{fmt(t('timeLeft'), { t: `${Math.floor(Math.max(0, left) / 60)}:${String(Math.max(0, left) % 60).padStart(2, '0')}` })}</span>
            <button type="button" class="btn btn-small" aria-pressed={paused} onClick={() => setPaused(!paused)}>
              {paused ? t('resume') : t('pause')}
            </button>
            <button type="button" class="btn btn-small" onClick={() => setLeft((s) => s + 300)}>
              {t('addTime')}
            </button>
          </div>
        )}
      </div>
      {paused ? (
        <p class="notice">{t('paused')}</p>
      ) : (
        <>
          <QuestionView
            key={q.id}
            lang={lang}
            t={t}
            q={q}
            a={a}
            reveal={checked && !exam}
            freeRecall={props.freeRecall}
            onChoose={(choice) => !checked && setA({ choice })}
            onText={(text) => setA({ text })}
            onGrade={exam ? undefined : gradeShort}
          />
          <p class="quiz-actions">
            {!exam && !checked && q.kind !== 'short' && (
              <button type="button" class="btn btn-primary" disabled={!a.choice} onClick={() => void check()}>
                {t('check')}
              </button>
            )}
            {(exam || checked) && (
              <button type="button" class="btn btn-primary" onClick={next}>
                {pos + 1 >= questions.length ? t('finish') : t('next')}
              </button>
            )}
          </p>
        </>
      )}
    </section>
  );
}

function QuestionView(props: {
  lang: Lang;
  t: T;
  q: QuizQuestion;
  a: Answer;
  reveal: boolean;
  freeRecall: boolean;
  onChoose?: (id: string) => void;
  onText?: (s: string) => void;
  onGrade: ((g: Answer['grade']) => void) | undefined;
}) {
  const { t, q, a, reveal } = props;
  const [optionsShown, setOptionsShown] = useState(false);
  const freeRecall = props.freeRecall && q.kind !== 'short';
  const [modelShown, setModelShown] = useState(false);
  const name = `q-${q.id}`;
  const showOptions = !freeRecall || optionsShown || reveal;

  return (
    <div class="question">
      <p class="stem">{q.stem}</p>
      {q.image && <Figure img={{ ...q.image, shapes: [], target: 0 }} />}
      {(q.kind === 'short' || (freeRecall && !optionsShown && !reveal)) && props.onText && (
        <label class="free-answer">
          <span>{q.kind === 'short' ? t('yourAnswer') : t('freeRecall')}</span>
          <textarea rows={3} value={a.text ?? ''} onInput={(e) => props.onText?.((e.target as HTMLTextAreaElement).value)} />
        </label>
      )}
      {q.kind !== 'short' && !showOptions && (
        <button type="button" class="btn" onClick={() => setOptionsShown(true)}>
          {t('showOptions')}
        </button>
      )}
      {q.kind !== 'short' && showOptions && (
        <fieldset class="options">
          <legend class="visually-hidden">{q.stem}</legend>
          {q.options.map((o) => {
            const chosen = a.choice === o.id;
            return (
              <div class={`option${reveal ? (o.correct ? ' is-correct' : chosen ? ' is-wrong' : '') : ''}`}>
                <label class="radio">
                  <input type="radio" name={name} value={o.id} checked={chosen} disabled={reveal || !props.onChoose} onChange={() => props.onChoose?.(o.id)} />
                  <span>{o.text}</span>
                </label>
                {reveal && (
                  <p class="why small">
                    <strong>
                      {o.correct ? `✓ ${t('whyRight')}` : `✗ ${t('whyWrong')}`}
                      {chosen && ` (${t('yourChoice')})`}:
                    </strong>{' '}
                    {o.why}
                  </p>
                )}
              </div>
            );
          })}
        </fieldset>
      )}
      {q.kind === 'short' && (
        <div class="short-answer">
          {!modelShown && !a.grade && props.onGrade ? (
            <button type="button" class="btn" onClick={() => setModelShown(true)}>
              {t('showModel')}
            </button>
          ) : (
            (modelShown || a.grade || reveal) && (
              <>
                <p>
                  <strong>{t('modelAnswer')}:</strong> {q.answer ?? q.options.find((o) => o.correct)?.text}
                </p>
                {props.onGrade && !a.grade && (
                  <div role="group" aria-label={t('selfGrade')} class="self-grade">
                    <span>{t('selfGrade')}</span>
                    <button type="button" class="btn btn-small" onClick={() => props.onGrade?.('right')}>
                      {t('gradeRight')}
                    </button>
                    <button type="button" class="btn btn-small" onClick={() => props.onGrade?.('partial')}>
                      {t('gradePartial')}
                    </button>
                    <button type="button" class="btn btn-small" onClick={() => props.onGrade?.('wrong')}>
                      {t('gradeWrong')}
                    </button>
                  </div>
                )}
              </>
            )
          )}
        </div>
      )}
      {(reveal || a.grade) && (
        <p class={`verdict ${isRight(q, a) ? 'is-correct' : 'is-wrong'}`} role="status">
          {q.kind === 'short' && !a.grade ? '' : isRight(q, a) ? `✓ ${t('correct')}` : `✗ ${t('wrong')}`}
        </p>
      )}
      {(reveal || a.grade) && q.back && (
        <p class="small">
          <a href={q.back.href}>
            {t('reviewThis')}: {q.back.label} →
          </a>
        </p>
      )}
    </div>
  );
}
