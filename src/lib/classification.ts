/**
 * Entity `classification` block → the line ClassificationNote renders, plus the
 * newest edition that supersedes the cited one (computed at build time from
 * sources.yaml; no request leaves the browser). docs/WHO_WATCH.md.
 */
import type { Entity, Source } from './schema.ts';

/** Statuses that make a newer edition worth announcing (forthcoming is not out yet). */
const AVAILABLE = new Set(['print', 'online-beta']);

export type ClassificationView = {
  source: Source;
  volume?: number;
  checked: Date;
  /** Newest available edition that supersedes `source`, following the `supersedes` chain. */
  newer?: Source;
};

export function classificationView(ref: Entity['classification'], sources: readonly Source[]): ClassificationView | undefined {
  if (!ref) return undefined;
  const source = sources.find((s) => s.id === ref.source);
  if (!source) return undefined; // the references gate (tests/content/gates.ts) reports unknown ids
  let newer: Source | undefined;
  let current = source.id;
  for (let hops = 0; hops < sources.length; hops++) {
    const next = sources.find((s) => s.supersedes === current && s.status && AVAILABLE.has(s.status));
    if (!next) break;
    newer = next;
    current = next.id;
  }
  return { source, volume: ref.volume ?? source.volume, checked: ref.checked, newer };
}

/** "5th" / "5ª" — WHO editions are small integers. */
export function editionLabel(lang: 'it' | 'en', n: number): string {
  if (lang === 'it') return `${n}ª ed.`;
  const s = n % 100 >= 11 && n % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th';
  return `${n}${s} ed.`;
}
