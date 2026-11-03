/**
 * Differential builder ranking (NAVIGATION_SPEC §5). Pure: used in the browser
 * and in unit tests. A finding is `"<lens>:<term>"` from the four facets.
 */
export const DIFF_FACETS = ['system', 'pattern', 'marker', 'presentation'] as const;
export type DiffFacet = (typeof DIFF_FACETS)[number];

export type DiffEntity = {
  id: string;
  tier: 'core' | 'extended';
  /** Position in syllabus order (lower first). */
  order: number;
  findings: string[];
};
export type DiffResult = { id: string; matched: string[]; unmatched: string[] };

/** Candidates sharing >= 1 selected finding, by overlap, then tier (core first), then syllabus order. */
export function rankDifferential(entities: readonly DiffEntity[], selected: readonly string[]): DiffResult[] {
  const tierRank = { core: 0, extended: 1 } as const;
  return entities
    .map((e) => {
      const own = new Set(e.findings);
      return { e, matched: selected.filter((f) => own.has(f)), unmatched: selected.filter((f) => !own.has(f)) };
    })
    .filter((r) => r.matched.length > 0)
    .sort(
      (a, b) =>
        b.matched.length - a.matched.length || tierRank[a.e.tier] - tierRank[b.e.tier] || a.e.order - b.e.order,
    )
    .map(({ e, matched, unmatched }) => ({ id: e.id, matched, unmatched }));
}
