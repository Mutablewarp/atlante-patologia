/** Planner (/[lang]/study/planner/): exam date + weekly hours → week-by-week schedule. */
import { useEffect, useState } from 'preact/hooks';
import type { Lang } from '../i18n/index.ts';
import { fmt, formatDate } from '../i18n/index.ts';
import { tS } from '../i18n/study.ts';
import { get, getAll, put } from '../lib/db.ts';
import { buildPlan, MINUTES_PER_ENTITY, type Plan } from '../lib/planner.ts';
import { entityAccuracy } from '../lib/quiz.ts';
import { langPath } from '../lib/url.ts';
import { loadIndex, useLoad, studyTime, type StudyIndex } from './client.ts';

/** 0..1 per module: wrong-answer share in quizzes (≥ 3 answers) or lapse share in reviews, whichever is higher. */
async function weakness(index: StudyIndex): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  try {
    const acc = entityAccuracy(await getAll('quizAttempts'));
    const cards = await getAll('cards');
    for (const m of index.modules) {
      const ents = index.entities.filter((e) => e.module === m.id).map((e) => e.id);
      let right = 0;
      let total = 0;
      for (const e of ents) {
        right += acc.get(e)?.right ?? 0;
        total += acc.get(e)?.total ?? 0;
      }
      const cs = cards.filter((c) => c.module === m.id);
      const reps = cs.reduce((s, c) => s + c.fsrs.reps, 0);
      const lapses = cs.reduce((s, c) => s + c.fsrs.lapses, 0);
      out.set(m.id, Math.max(total >= 3 ? 1 - right / total : 0, reps >= 5 ? lapses / reps : 0));
    }
  } catch {
    /* no storage: no weighting */
  }
  return out;
}

export default function Planner({ lang }: { lang: Lang }) {
  const t = (k: Parameters<typeof tS>[1]) => tS(lang, k);
  const idx = useLoad(() => loadIndex(lang));
  const [examDate, setExamDate] = useState('');
  const [hours, setHours] = useState(10);
  const [plan, setPlan] = useState<Plan | null | undefined>();
  const [weak, setWeak] = useState(new Map<string, number>());

  async function compute(date: string, h: number, index: StudyIndex, save: boolean) {
    const w = await weakness(index);
    setWeak(w);
    const p = buildPlan({
      today: new Date(),
      examDate: date,
      hoursPerWeek: h,
      modules: index.modules.map((m) => ({
        id: m.id,
        section: m.section,
        order: m.order,
        entities: index.entities.filter((e) => e.module === m.id).length,
        weakness: w.get(m.id) ?? 0,
      })),
    });
    setPlan(p);
    if (save && p) await put('plan', { id: 'current', examDate: date, hoursPerWeek: h, updated: Date.now() }).catch(() => {});
  }

  useEffect(() => {
    if (!idx.data) return;
    get('plan', 'current')
      .then((p) => {
        if (!p) return;
        setExamDate(p.examDate);
        setHours(p.hoursPerWeek);
        void compute(p.examDate, p.hoursPerWeek, idx.data!, false);
      })
      .catch(() => {});
  }, [idx.data]);

  if (idx.loading) return <p aria-live="polite">{t('loading')}</p>;
  const index = idx.data;
  if (!index || !index.modules.length) return <p class="empty-state">{t('noContent')}</p>;
  const label = (id: string) => `${id.toUpperCase()} · ${index.modules.find((m) => m.id === id)?.label ?? ''}`;
  const date = (iso: string) => formatDate(lang, new Date(`${iso}T00:00:00Z`));

  return (
    <div class="study-tool">
      <form
        class="card tool-form"
        onSubmit={(e) => {
          e.preventDefault();
          void compute(examDate, hours, index, true);
        }}
      >
        <label>
          <span>{t('examDate')}</span>
          <input type="date" required value={examDate} onInput={(e) => setExamDate((e.target as HTMLInputElement).value)} />
        </label>
        <label>
          <span>{t('hoursPerWeek')}</span>
          <input type="number" min={1} max={80} required value={hours} onInput={(e) => setHours(Number((e.target as HTMLInputElement).value))} />
        </label>
        <p>
          <button type="submit" class="btn btn-primary">
            {t('makePlan')}
          </button>
        </p>
      </form>
      <div aria-live="polite">
        {plan === null && <p class="notice notice-caution">{t('planInvalid')}</p>}
        {plan && (
          <>
            <p class="small muted">{fmt(t('planEstimate'), { n: MINUTES_PER_ENTITY })}</p>
            {plan.unscheduled.length > 0 && (
              <p class="notice notice-caution">
                {fmt(t('planShortfall'), { t: studyTime(lang, plan.unscheduled.reduce((s, x) => s + x.minutes, 0)) })}
              </p>
            )}
            <ol class="plan">
              {plan.weeks.map((w) => (
                <li class={`card plan-week${w.kind === 'revision' ? ' is-revision' : ''}`}>
                  <h2 class="plan-title">
                    {fmt(t(w.kind === 'revision' ? 'revisionWeek' : 'week'), { from: date(w.start), to: date(w.end) })}
                  </h2>
                  {w.kind === 'revision' ? (
                    <>
                      <p>{t('revisionBody')}</p>
                      <p>
                        <a class="btn btn-small" href={langPath(lang, 'study/review/?cram=1')}>
                          {t('lastWeekCta')}
                        </a>{' '}
                        <a class="btn btn-small" href={langPath(lang, 'study/quiz/?mode=weak')}>
                          {t('modeWeak')}
                        </a>
                      </p>
                    </>
                  ) : (
                    <ul>
                      {w.study.map((s) => (
                        <li>
                          {label(s.module)} — {studyTime(lang, s.minutes)}
                          {(weak.get(s.module) ?? 0) > 0.3 && <span class="badge badge-eosin">{t('weakTag')}</span>}
                        </li>
                      ))}
                      <li class="muted">{fmt(t('reviewSlot'), { t: studyTime(lang, w.reviewMinutes) })}</li>
                    </ul>
                  )}
                </li>
              ))}
            </ol>
          </>
        )}
      </div>
    </div>
  );
}
