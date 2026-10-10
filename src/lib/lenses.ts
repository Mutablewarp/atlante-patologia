/**
 * Lens membership (NAVIGATION_SPEC §2): which entities belong to each lens term,
 * in syllabus order, plus prev/next within a lens term.
 */
import type { LensId } from './schema.ts';
import { LENSES } from './schema.ts';

export type LensEntity = {
  id: string;
  module: string;
  names: { it: string; en: string };
  lenses: Record<LensId, string[]>;
};

/** Syllabus order: module order, then English name (stable across languages). */
export function syllabusSort<T extends LensEntity>(entities: readonly T[], moduleOrder: ReadonlyMap<string, number>): T[] {
  return [...entities].sort(
    (a, b) =>
      (moduleOrder.get(a.module) ?? 999) - (moduleOrder.get(b.module) ?? 999) ||
      a.names.en.localeCompare(b.names.en, 'en'),
  );
}

/** lens → term → entity ids (syllabus order). Terms without entities are absent. */
export function lensMembership<T extends LensEntity>(
  entities: readonly T[],
  moduleOrder: ReadonlyMap<string, number>,
): Map<LensId, Map<string, string[]>> {
  const out = new Map<LensId, Map<string, string[]>>(LENSES.map((l) => [l, new Map()]));
  for (const e of syllabusSort(entities, moduleOrder)) {
    for (const lens of LENSES) {
      for (const term of e.lenses[lens] ?? []) {
        const terms = out.get(lens)!;
        terms.set(term, [...(terms.get(term) ?? []), e.id]);
      }
    }
  }
  return out;
}

export function nonEmptyLensCount(e: Pick<LensEntity, 'lenses'>): number {
  return LENSES.filter((l) => (e.lenses[l] ?? []).length > 0).length;
}

/** The default navigation context of an entity: its first organ-system term. */
export function primaryTerm(e: Pick<LensEntity, 'lenses'>): { lens: LensId; term: string } | undefined {
  const term = e.lenses.system?.[0];
  return term ? { lens: 'system', term } : undefined;
}

export function prevNext(ids: readonly string[], id: string): { prev?: string; next?: string } {
  const i = ids.indexOf(id);
  if (i === -1) return {};
  return { prev: ids[i - 1], next: ids[i + 1] };
}

/** Lens terms referenced by entities that do not exist in the taxonomy. */
export function unknownTerms(
  entities: readonly Pick<LensEntity, 'id' | 'lenses'>[],
  taxonomy: ReadonlyMap<LensId, ReadonlySet<string>>,
): string[] {
  const out: string[] = [];
  for (const e of entities)
    for (const lens of LENSES)
      for (const t of e.lenses[lens] ?? []) if (!taxonomy.get(lens)?.has(t)) out.push(`${e.id}: ${lens}/${t}`);
  return out;
}
