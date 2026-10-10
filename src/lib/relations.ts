/**
 * Relation graph (CONTENT_SCHEMA §2, D012): symmetric types declared once are
 * mirrored onto the target; directed types show an inverse label on the target.
 */
import type { RelationTypeId } from './schema.ts';
import { RELATION_TYPES } from './schema.ts';
import type { L } from '../i18n/index.ts';

export const SYMMETRIC: ReadonlySet<RelationTypeId> = new Set([
  'sharesMechanism',
  'differentialOf',
  'sameLesionOtherOrgan',
  'sameMarker',
]);

export const RELATION_LABELS: Record<RelationTypeId, { forward: L; inverse: L }> = {
  sharesMechanism: { forward: { en: 'Shares mechanism with', it: 'Condivide il meccanismo con' }, inverse: { en: 'Shares mechanism with', it: 'Condivide il meccanismo con' } },
  differentialOf: { forward: { en: 'Differential diagnosis', it: 'Diagnosi differenziale' }, inverse: { en: 'Differential diagnosis', it: 'Diagnosi differenziale' } },
  sameLesionOtherOrgan: { forward: { en: 'Same lesion, other organ', it: 'Stessa lesione, altro organo' }, inverse: { en: 'Same lesion, other organ', it: 'Stessa lesione, altro organo' } },
  sameMarker: { forward: { en: 'Same marker', it: 'Stesso marcatore' }, inverse: { en: 'Same marker', it: 'Stesso marcatore' } },
  mimics: { forward: { en: 'Can mimic', it: 'Può simulare' }, inverse: { en: 'Can be mimicked by', it: 'Può essere simulato da' } },
  complicationOf: { forward: { en: 'Complication of', it: 'Complicanza di' }, inverse: { en: 'Possible complication', it: 'Può complicarsi con' } },
  causes: { forward: { en: 'Causes', it: 'Causa' }, inverse: { en: 'Caused by', it: 'Causato da' } },
  prerequisiteOf: { forward: { en: 'Prerequisite for', it: 'Prerequisito per' }, inverse: { en: 'Builds on', it: 'Si basa su' } },
};

export type RelationInput = { id: string; relations: { type: RelationTypeId; target: string; note?: L }[] };
export type Direction = 'forward' | 'inverse';
export type RelatedItem = { target: string; note?: L };
export type RelationGroup = { type: RelationTypeId; direction: Direction; label: L; items: RelatedItem[] };

/**
 * For every entity, its related items grouped by (type, direction), in the
 * canonical type order. Symmetric relations always appear as `forward` on both
 * sides; duplicates (declared on both sides) are collapsed.
 */
export function buildRelationIndex(entities: readonly RelationInput[]): Map<string, RelationGroup[]> {
  const acc = new Map<string, Map<string, RelatedItem[]>>();
  const add = (from: string, type: RelationTypeId, dir: Direction, item: RelatedItem) => {
    const groups = acc.get(from) ?? new Map<string, RelatedItem[]>();
    acc.set(from, groups);
    const key = `${type}:${dir}`;
    const list = groups.get(key) ?? [];
    if (!list.some((x) => x.target === item.target)) list.push(item);
    groups.set(key, list);
  };

  for (const e of entities) {
    for (const r of e.relations) {
      if (r.target === e.id) continue; // self-links are rejected by the schema; never render them
      add(e.id, r.type, 'forward', { target: r.target, note: r.note });
      add(r.target, r.type, SYMMETRIC.has(r.type) ? 'forward' : 'inverse', { target: e.id, note: r.note });
    }
  }

  const out = new Map<string, RelationGroup[]>();
  for (const [id, groups] of acc) {
    const list: RelationGroup[] = [];
    for (const type of RELATION_TYPES) {
      for (const direction of ['forward', 'inverse'] as const) {
        const items = groups.get(`${type}:${direction}`);
        if (items?.length) list.push({ type, direction, label: RELATION_LABELS[type][direction], items });
      }
    }
    out.set(id, list);
  }
  return out;
}

/** Directed pairs that contradict each other (A causes B and B causes A). */
export function contradictoryPairs(entities: readonly RelationInput[]): string[] {
  const seen = new Set<string>();
  const problems: string[] = [];
  for (const e of entities)
    for (const r of e.relations) if (!SYMMETRIC.has(r.type)) seen.add(`${r.type}|${e.id}|${r.target}`);
  for (const key of seen) {
    const [type, a, b] = key.split('|');
    if (a! < b! && seen.has(`${type}|${b}|${a}`)) problems.push(`${a} ${type} ${b} and ${b} ${type} ${a}`);
  }
  return problems;
}
