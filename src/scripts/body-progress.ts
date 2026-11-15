/**
 * Body page: how much of each organ and system the learner has seen, mastered and has due.
 * `organProgress` is pure (unit-tested); the rest reads the learner database the study pages use
 * and writes into the `[data-progress]` elements the tree already holds, so nothing moves.
 */
import { fmt } from '../i18n/index.ts';
import { getAll } from '../lib/db.ts';
import { dueCount, isMastered } from '../lib/progress.ts';
import type { StoredFsrs } from '../lib/srs.ts';

export type Progress = { total: number; seen: number; mastered: number; due: number };
export type LearnerData = {
  /** entity ids of the readProgress records */
  read: readonly string[];
  /** entity ids of the review-log entries */
  logged: readonly string[];
  cards: readonly { entity: string; fsrs: StoredFsrs }[];
};

/**
 * Per group (organ or system) of entity ids: seen = read, reviewed or holding a card state;
 * mastered = it has cards and all are mature (same test as the Me page); due = a card is due today.
 */
export function organProgress(groups: Readonly<Record<string, readonly string[]>>, data: LearnerData, now = new Date()): Record<string, Progress> {
  const seen = new Set([...data.read, ...data.logged, ...data.cards.map((c) => c.entity)]);
  const byEntity = new Map<string, StoredFsrs[]>();
  for (const c of data.cards) byEntity.set(c.entity, [...(byEntity.get(c.entity) ?? []), c.fsrs]);
  const mastered = (id: string) => (byEntity.get(id) ?? []).length > 0 && byEntity.get(id)!.every((f) => isMastered(f));
  const due = (id: string) => dueCount((byEntity.get(id) ?? []).map((fsrs) => ({ fsrs })), now) > 0;
  return Object.fromEntries(
    Object.entries(groups).map(([key, ids]) => {
      const unique = [...new Set(ids)];
      return [key, { total: unique.length, seen: unique.filter((i) => seen.has(i)).length, mastered: unique.filter(mastered).length, due: unique.filter(due).length }];
    }),
  );
}

const idsOf = (el: Element) => (el.getAttribute('data-cards') ?? '').split(/[\s,]+/).filter(Boolean);

async function paint(): Promise<void> {
  const holders = [...document.querySelectorAll<HTMLElement>('[data-cards]')];
  if (!holders.length) return;
  const [read, logged, cards] = await Promise.all([getAll('readProgress'), getAll('reviewLog'), getAll('cards')]);
  const result = organProgress(
    Object.fromEntries(holders.map((h, i) => [String(i), idsOf(h)])),
    { read: read.map((r) => r.entity), logged: logged.map((r) => r.entity), cards },
  );
  holders.forEach((h, i) => {
    const p = result[String(i)];
    for (const key of ['seen', 'mastered', 'due'] as const) {
      const out = h.querySelector<HTMLElement>(`:scope > [data-progress] [data-k="${key}"]`);
      const template = out?.getAttribute('data-t');
      if (out && template) out.textContent = fmt(template, { n: p[key], total: p.total });
    }
  });
}

// Without IndexedDB the counters stay empty and the "Review this organ" link still works.
if (typeof document !== 'undefined') {
  paint().catch(() => {});
  window.addEventListener('ap:data', () => void paint().catch(() => {}));
}
