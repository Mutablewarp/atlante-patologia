/**
 * Client helpers shared by the study islands: static JSON loading (same
 * origin, no third parties), the learner DB snapshot and small formatters.
 */
import { useEffect, useState } from 'preact/hooks';
import type { Lang } from '../i18n/index.ts';
import { fmt } from '../i18n/index.ts';
import { tS } from '../i18n/study.ts';
import { langPath } from '../lib/url.ts';
import type { StudyCard } from '../lib/cards.ts';
import type { QuizQuestion } from '../lib/quiz.ts';
import type { StudyIndex } from '../lib/study.ts';
import type { OralQuestion } from '../lib/oral.ts';

export type { StudyCard, QuizQuestion, StudyIndex };

async function json<T>(lang: Lang, path: string): Promise<T> {
  const res = await fetch(langPath(lang, `data/${path}`));
  if (!res.ok) throw new Error(`${res.status} ${path}`);
  return (await res.json()) as T;
}

export const loadIndex = (lang: Lang) => json<StudyIndex>(lang, 'study.json');
export const loadOral = (lang: Lang) => json<OralQuestion[]>(lang, 'oral.json');

export async function loadCards(lang: Lang, modules: string[]): Promise<StudyCard[]> {
  return (await Promise.all(modules.map((m) => json<StudyCard[]>(lang, `cards/${m}.json`)))).flat();
}

export async function loadQuestions(lang: Lang, modules: string[]): Promise<QuizQuestion[]> {
  return (await Promise.all(modules.map((m) => json<QuizQuestion[]>(lang, `questions/${m}.json`)))).flat();
}

/** Run an async loader once; `error` holds the thrown value. */
export function useLoad<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [state, setState] = useState<{ data?: T; error?: unknown; loading: boolean }>({ loading: true });
  useEffect(() => {
    let live = true;
    setState({ loading: true });
    fn().then(
      (data) => live && setState({ data, loading: false }),
      (error: unknown) => live && setState({ error, loading: false }),
    );
    return () => {
      live = false;
    };
  }, deps);
  return state;
}

export const entityHref = (lang: Lang, entity: string, section?: string) => langPath(lang, `e/${entity}/${section ? `#${section}` : ''}`);

/** Human interval: 5 min, 3 h, 4 d, 2 mo. */
export function interval(lang: Lang, ms: number): string {
  const min = Math.max(1, Math.round(ms / 60_000));
  if (min < 60) return fmt(tS(lang, 'minutes'), { n: min });
  const h = Math.round(min / 60);
  if (h < 24) return fmt(tS(lang, 'hours'), { n: h });
  const d = Math.round(h / 24);
  if (d < 60) return fmt(tS(lang, 'days'), { n: d });
  return fmt(tS(lang, 'months'), { n: Math.round(d / 30) });
}

/** Study time in minutes → "40 min" or "2,5 h" (hours, never days: these are hours of work). */
export function studyTime(lang: Lang, minutes: number): string {
  if (minutes < 60) return fmt(tS(lang, 'minutes'), { n: Math.round(minutes) });
  const h = new Intl.NumberFormat(lang === 'it' ? 'it-IT' : 'en-GB', { maximumFractionDigits: 1 }).format(Math.round(minutes / 30) / 2);
  return fmt(tS(lang, 'hours'), { n: h });
}

export const param = (k: string) => (typeof location === 'undefined' ? null : new URLSearchParams(location.search).get(k));
