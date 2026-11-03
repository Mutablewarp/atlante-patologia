/**
 * Navigation graph over content links (NAVIGATION_SPEC §7). Links inside
 * data-nav="global" regions (top bar, primary nav, footer) do not count.
 * Writes the entity-to-entity hop report to reports/nav-hops.json.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BASE, LANGS, contentGraph, distances, isEntity, lensDistances, pages } from './lib.ts';

const all = pages();
const graph = contentGraph(all);
const ROOT = BASE;
const NOT_FOUND = `${BASE}404.html`;
// Tab roots are linked from the primary navigation on every page by design;
// the orphan rule is about content pages, so they are exempt (with / and 404).
const TAB_ROOTS = LANGS.flatMap((l) => ['', 'atlas/', 'study/', 'search/', 'me/'].map((p) => `${BASE}${l}/${p}`));
// The offline fallback is served by the service worker in place of a missing page, like 404.
const OFFLINE = LANGS.map((l) => `${BASE}${l}/offline/`);
const ORPHAN_EXEMPT = new Set([ROOT, NOT_FOUND, ...TAB_ROOTS, ...OFFLINE]);

describe('navigation graph (content links only)', () => {
  it('finds the built pages', () => {
    expect(all.length).toBeGreaterThan(10);
  });

  it('has no orphans: every page has an inbound content link', () => {
    const inbound = new Set([...graph.values()].flatMap((s) => [...s]));
    const orphans = all.map((p) => p.url).filter((u) => !ORPHAN_EXEMPT.has(u) && !inbound.has(u));
    expect(orphans).toEqual([]);
  });

  it('has no dead ends: every page links onward from its content', () => {
    const deadEnds = [...graph].filter(([, out]) => out.size === 0).map(([u]) => u);
    expect(deadEnds).toEqual([]);
  });

  it('reaches every entity from /{lang}/ in ≤ 3 steps through a lens', () => {
    const tooFar: string[] = [];
    for (const lang of LANGS) {
      const viaLens = lensDistances(graph, `${BASE}${lang}/`);
      for (const p of all.filter((x) => x.url.startsWith(`${BASE}${lang}/e/`) && isEntity(x.url))) {
        const d = viaLens.get(p.url);
        if (d === undefined || d > 3) tooFar.push(`${p.url} (${d ?? 'unreachable'})`);
      }
    }
    expect(tooFar).toEqual([]);
  });

  it('writes the entity hop-distance report', () => {
    const report: Record<string, unknown> = { generated: new Date().toISOString() };
    for (const lang of LANGS) {
      const entities = all.map((p) => p.url).filter((u) => u.startsWith(`${BASE}${lang}/e/`) && isEntity(u));
      const hops: number[] = [];
      const unreachable: [string, string][] = [];
      for (const a of entities) {
        const d = distances(graph, a);
        for (const b of entities) {
          if (a === b) continue;
          const n = d.get(b);
          if (n === undefined) unreachable.push([a, b]);
          else hops.push(n);
        }
      }
      hops.sort((x, y) => x - y);
      report[lang] = {
        entities: entities.length,
        pairs: entities.length * Math.max(entities.length - 1, 0),
        median: hops.length ? hops[Math.floor(hops.length / 2)] : null,
        max: hops.length ? hops[hops.length - 1] : null,
        unreachablePairs: unreachable.length,
        unreachable: unreachable.slice(0, 200),
      };
    }
    const dir = join(process.cwd(), 'reports');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'nav-hops.json'), `${JSON.stringify(report, null, 2)}\n`);
    expect(report.it).toBeDefined();
  });
});
