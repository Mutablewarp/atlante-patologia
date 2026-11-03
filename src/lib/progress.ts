/**
 * Reading progress and light card helpers shared by content pages (no ts-fsrs
 * import here: content pages must stay small).
 */
import { SECTIONS } from '../i18n/sections.ts';
import type { StoredFsrs } from './srs.ts';

/** Sections a learner can read on an entity page: the 13 fixed ones plus Quick check. */
export const SECTION_COUNT = SECTIONS.length + 1;
/** An entity counts as read when this share of its sections was scrolled through. */
export const READ_SHARE = 0.8;

/** Entity ids from an attribute list: space- and/or comma-separated (H07, D045). */
export const parseIdList = (value: string | null): string[] => (value ?? '').split(/[\s,]+/).filter(Boolean);

/** entity id → number of distinct sections read. */
export function sectionsRead(rows: readonly { entity: string; section: string }[]): Map<string, number> {
  const seen = new Map<string, Set<string>>();
  for (const r of rows) seen.set(r.entity, (seen.get(r.entity) ?? new Set()).add(r.section));
  return new Map([...seen].map(([e, s]) => [e, s.size]));
}

export function entitiesRead(rows: readonly { entity: string; section: string }[]): Set<string> {
  const need = Math.ceil(SECTION_COUNT * READ_SHARE);
  return new Set([...sectionsRead(rows)].filter(([, n]) => n >= need).map(([e]) => e));
}

/** Mature = in review (State.Review = 2) and expected to be remembered for three weeks or more. */
export const MATURE_DAYS = 21;
export const isMastered = (s: StoredFsrs | undefined) => !!s && s.state === 2 && s.stability >= MATURE_DAYS;

/** Same as ts-fsrs `createEmptyCard(now)`, stored form (tested against it). */
export function emptyFsrs(now: number): StoredFsrs {
  return { due: now, stability: 0, difficulty: 0, elapsed_days: 0, scheduled_days: 0, reps: 0, lapses: 0, learning_steps: 0, state: 0 };
}

/** Cards due by the end of the learner's local day (new cards never count as debt). */
export function dueCount(rows: readonly { fsrs: StoredFsrs }[], now = new Date()): number {
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  return rows.filter((r) => r.fsrs.state !== 0 && r.fsrs.due <= end.getTime()).length;
}
