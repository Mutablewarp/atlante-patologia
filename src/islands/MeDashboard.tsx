/** Me dashboard (/[lang]/me/): coverage, mastery, review debt, weak spots. Honest numbers only. */
import type { Lang } from '../i18n/index.ts';
import { fmt } from '../i18n/index.ts';
import { tS } from '../i18n/study.ts';
import { getAll } from '../lib/db.ts';
import { entityAccuracy } from '../lib/quiz.ts';
import { entitiesRead, dueCount, isMastered } from '../lib/progress.ts';
import { loadIndex, useLoad, entityHref } from './client.ts';

async function load(lang: Lang) {
  const index = await loadIndex(lang);
  const [cards, read, attempts, errors] = await Promise.all([getAll('cards'), getAll('readProgress'), getAll('quizAttempts'), getAll('errors')]);
  return { index, cards, read, attempts, errors };
}

export default function MeDashboard({ lang }: { lang: Lang }) {
  const t = (k: Parameters<typeof tS>[1]) => tS(lang, k);
  const s = useLoad(() => load(lang));
  if (s.loading) return <p aria-live="polite">{t('loading')}</p>;
  if (s.error || !s.data) return <p class="notice notice-caution">{t('storageError')}</p>;
  const { index, cards, read, attempts, errors } = s.data;
  if (!cards.length && !read.length && !attempts.length && !errors.length) return <p class="empty-state">{t('meEmpty')}</p>;

  const published = new Set(index.entities.map((e) => e.id));
  const readSet = entitiesRead(read);
  const state = new Map(cards.map((c) => [c.id, c]));
  const allCardIds = index.entities.flatMap((e) => e.cards);
  const mastered = allCardIds.filter((id) => isMastered(state.get(id)?.fsrs)).length;
  const acc = entityAccuracy(attempts);
  const lapses = new Map<string, number>();
  for (const c of cards) lapses.set(c.entity, (lapses.get(c.entity) ?? 0) + c.fsrs.lapses);
  const logged = new Set(errors.map((e) => e.entity));
  const weak = index.entities
    .map((e) => {
      const a = acc.get(e.id) ?? { right: 0, total: 0 };
      const quizWeak = a.total >= 2 && a.right / a.total < 0.7;
      const score = (a.total ? 1 - a.right / a.total : 0) + (lapses.get(e.id) ?? 0) * 0.25 + (logged.has(e.id) ? 0.5 : 0);
      return { e, a, score, flagged: quizWeak || (lapses.get(e.id) ?? 0) >= 2 || logged.has(e.id) };
    })
    .filter((x) => x.flagged)
    .sort((x, y) => y.score - x.score)
    .slice(0, 8);

  return (
    <div class="me-dashboard">
      <ul class="grid stats">
        <li>
          <section class="card stat" aria-labelledby="st-cov">
            <h2 id="st-cov" class="kicker">{t('coverage')}</h2>
            <p class="stat-value">{[...readSet].filter((id) => published.has(id)).length}</p>
            <p class="small">{fmt(t('coverageBody'), { read: [...readSet].filter((id) => published.has(id)).length, total: published.size })}</p>
          </section>
        </li>
        <li>
          <section class="card stat" aria-labelledby="st-mas">
            <h2 id="st-mas" class="kicker">{t('mastery')}</h2>
            <p class="stat-value">{mastered}</p>
            <p class="small">{fmt(t('masteryBody'), { mastered, total: allCardIds.length })}</p>
          </section>
        </li>
        <li>
          <section class="card stat" aria-labelledby="st-debt">
            <h2 id="st-debt" class="kicker">{t('debt')}</h2>
            <p class="stat-value">{dueCount(cards)}</p>
            <p class="small">{fmt(t('debtBody'), { n: dueCount(cards) })}</p>
          </section>
        </li>
      </ul>

      <section aria-labelledby="weak-title">
        <h2 id="weak-title">{t('weakSpots')}</h2>
        {weak.length ? (
          <ul class="weak-list">
            {weak.map(({ e, a }) => (
              <li>
                <a href={entityHref(lang, e.id)}>{e.name}</a>{' '}
                <span class="small muted">{fmt(t('weakReason'), { right: a.right, total: a.total, lapses: lapses.get(e.id) ?? 0 })}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p class="muted">{t('weakEmpty')}</p>
        )}
      </section>

      <section aria-labelledby="mod-title">
        <h2 id="mod-title">{t('byModule')}</h2>
        <div class="table-scroll" tabIndex={0} role="region" aria-labelledby="mod-title">
          <table>
            <thead>
              <tr>
                <th scope="col">{t('module')}</th>
                <th scope="col">{t('coverage')}</th>
                <th scope="col">{t('mastery')}</th>
              </tr>
            </thead>
            <tbody>
              {index.modules.map((m) => {
                const ents = index.entities.filter((e) => e.module === m.id);
                const ids = ents.flatMap((e) => e.cards);
                return (
                  <tr>
                    <th scope="row">
                      {m.id.toUpperCase()} · {m.label}
                    </th>
                    <td>
                      {ents.filter((e) => readSet.has(e.id)).length} / {ents.length}
                    </td>
                    <td>
                      {ids.filter((id) => isMastered(state.get(id)?.fsrs)).length} / {ids.length}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
