/**
 * Study planner (pure). Exam date + weekly hours → a week-by-week schedule:
 * general-pathology modules before systemic and organ modules (syllabus
 * order), weak modules get more time, every week keeps a review slot, and the
 * last week before the exam is revision only.
 */
export type PlanModule = { id: string; section: 'I' | 'II' | 'III'; order: number; entities: number; weakness: number };
export type PlanItem = { module: string; minutes: number };
export type PlanWeek = { start: string; end: string; kind: 'study' | 'revision'; study: PlanItem[]; reviewMinutes: number };
export type Plan = {
  weeks: PlanWeek[];
  /** Work that does not fit before the revision week (shown honestly, not hidden). */
  unscheduled: PlanItem[];
  neededMinutes: number;
  availableMinutes: number;
};

/** Rough reading + first-pass time per card (minutes). shortcut: fixed estimate; tune when real usage data exists. */
export const MINUTES_PER_ENTITY = 45;
/** Share of each study week reserved for spaced review. */
export const REVIEW_SHARE = 0.25;

const DAY = 86_400_000;
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);
const utcDay = (d: string | Date) => {
  const x = typeof d === 'string' ? new Date(`${d}T00:00:00Z`) : new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  return x.getTime();
};

export function buildPlan(input: { today: Date; examDate: string; hoursPerWeek: number; modules: PlanModule[] }): Plan | null {
  const start = utcDay(input.today);
  const exam = utcDay(input.examDate);
  if (!Number.isFinite(exam) || exam <= start || !(input.hoursPerWeek > 0)) return null;

  const weekMinutes = Math.round(input.hoursPerWeek * 60);
  const days = Math.round((exam - start) / DAY);
  const studyDays = Math.max(0, days - 7);
  const studyWeeks = Math.ceil(studyDays / 7);

  const queue: PlanItem[] = [...input.modules]
    .filter((m) => m.entities > 0)
    .sort((a, b) => a.section.localeCompare(b.section) || a.order - b.order)
    .map((m) => ({ module: m.id, minutes: Math.round(m.entities * MINUTES_PER_ENTITY * (1 + Math.min(1, Math.max(0, m.weakness)))) }));
  const neededMinutes = queue.reduce((s, q) => s + q.minutes, 0);

  const weeks: PlanWeek[] = [];
  let available = 0;
  for (let w = 0; w < studyWeeks; w++) {
    const from = start + w * 7 * DAY;
    const to = Math.min(from + 6 * DAY, start + (studyDays - 1) * DAY);
    const fraction = (Math.round((to - from) / DAY) + 1) / 7;
    const capacity = Math.round(weekMinutes * fraction);
    let free = Math.round(capacity * (1 - REVIEW_SHARE));
    available += free;
    const study: PlanItem[] = [];
    while (free > 0 && queue.length) {
      const head = queue[0]!;
      const take = Math.min(free, head.minutes);
      study.push({ module: head.module, minutes: take });
      head.minutes -= take;
      free -= take;
      if (head.minutes <= 0) queue.shift();
    }
    weeks.push({ start: iso(from), end: iso(to), kind: 'study', study, reviewMinutes: capacity - study.reduce((s, x) => s + x.minutes, 0) });
  }
  const revFrom = start + studyDays * DAY;
  weeks.push({ start: iso(revFrom), end: iso(exam - DAY), kind: 'revision', study: [], reviewMinutes: Math.round(weekMinutes * (Math.min(7, days) / 7)) });

  return { weeks, unscheduled: queue.filter((q) => q.minutes > 0), neededMinutes, availableMinutes: available };
}
