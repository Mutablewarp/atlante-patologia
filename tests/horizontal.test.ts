import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { entitySchema, glossarySchema, imageSchema, pathSchema, patternSchema } from '../src/lib/schema.ts';
import { resolveCrossLinks, type CrossLinkCtx } from '../src/lib/crosslinks.ts';
import { rankDifferential } from '../src/lib/differential.ts';
import { fold, fuzzyScore, bestScore } from '../src/lib/fuzzy.ts';
import { forceLayout } from '../src/lib/graph.ts';

const ctx: CrossLinkCtx = {
  lang: 'en',
  entityUrl: (id) => (id === 'a' ? '/en/e/a/' : undefined),
  entityName: (id) => ({ a: 'Alpha', b: 'Beta' })[id],
  glossary: new Map([['g1', { term: { it: 'Termine', en: 'Term' }, definition: { it: 'Def', en: 'A <def>' } }]]),
  glossaryUrl: (id) => `/en/atlas/az/#term-${id}`,
  strings: { planned: 'planned', glossary: 'Glossary', az: 'A–Z' },
};

describe('cross-links', () => {
  it('links visible entities and labels the rest as planned', () => {
    expect(resolveCrossLinks('<p>[[a]] and [[b]] and [[zz-top]]</p>', ctx)).toBe(
      '<p><a href="/en/e/a/" class="xref">Alpha</a> and ' +
        '<span class="xref-planned">Beta <span class="badge badge-planned">planned</span></span> and ' +
        '<span class="xref-planned">zz top <span class="badge badge-planned">planned</span></span></p>',
    );
  });
  it('keeps a custom label (already-escaped HTML)', () => {
    expect(resolveCrossLinks('[[a|A &amp; B]]', ctx)).toBe('<a href="/en/e/a/" class="xref">A &amp; B</a>');
  });
  it('renders glossary popovers with unique ids and escaped definitions', () => {
    const out = resolveCrossLinks('[[g:g1]] [[g:g1]] [[g:missing]]', ctx);
    expect(out).toContain('popovertarget="gloss-g1-1"');
    expect(out).toContain('id="gloss-g1-2"');
    expect(out).toContain('A &lt;def&gt;');
    expect(out).toContain('href="/en/atlas/az/#term-g1"');
    expect(out.endsWith(' missing')).toBe(true);
  });
  it('ignores text that is not a cross-link', () => {
    expect(resolveCrossLinks('[a] [[Not Valid]] [[x', ctx)).toBe('[a] [[Not Valid]] [[x');
  });
});

describe('differential ranking', () => {
  const E = [
    { id: 'ext', tier: 'extended' as const, order: 0, findings: ['system:heart', 'pattern:p'] },
    { id: 'core2', tier: 'core' as const, order: 2, findings: ['system:heart', 'pattern:p'] },
    { id: 'core1', tier: 'core' as const, order: 1, findings: ['system:heart', 'pattern:p'] },
    { id: 'one', tier: 'core' as const, order: 0, findings: ['marker:m', 'system:heart'] },
    { id: 'none', tier: 'core' as const, order: 0, findings: ['system:lung'] },
  ];
  it('ranks by overlap, then core before extended, then syllabus order', () => {
    const r = rankDifferential(E, ['system:heart', 'pattern:p']);
    expect(r.map((x) => x.id)).toEqual(['core1', 'core2', 'ext', 'one']);
    expect(r[3]).toEqual({ id: 'one', matched: ['system:heart'], unmatched: ['pattern:p'] });
  });
  it('returns nothing for no findings', () => {
    expect(rankDifferential(E, [])).toEqual([]);
  });
});

describe('fuzzy search', () => {
  it('folds accents and case', () => {
    expect(fold('Necrosi Caseosa É')).toBe('necrosi caseosa e');
  });
  it('prefers prefix > word start > substring > subsequence', () => {
    const p = fuzzyScore('nec', 'necrosis');
    const w = fuzzyScore('nec', 'fat necrosis');
    const s = fuzzyScore('cro', 'necrosis');
    const q = fuzzyScore('ncs', 'necrosis');
    expect(p).toBeGreaterThan(w);
    expect(w).toBeGreaterThan(s);
    expect(s).toBeGreaterThan(q);
    expect(q).toBeGreaterThan(0);
    expect(fuzzyScore('xyz', 'necrosis')).toBe(0);
  });
  it('takes the best key', () => {
    expect(bestScore('mi', ['infarto', 'mi'])).toBeGreaterThan(0);
  });
});

describe('concept map layout', () => {
  it('is deterministic and stays inside the box', () => {
    const ids = ['a', 'b', 'c', 'd', 'e'];
    const edges = [
      { from: 'a', to: 'b' },
      { from: 'b', to: 'c' },
    ];
    const one = forceLayout(ids, edges, { w: 800, h: 600 });
    const two = forceLayout(ids, edges, { w: 800, h: 600 });
    expect([...one]).toEqual([...two]);
    for (const p of one.values()) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(800);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(600);
    }
    expect(new Set([...one.values()].map((p) => `${p.x},${p.y}`)).size).toBe(5);
  });
  it('handles empty and single-node graphs', () => {
    expect(forceLayout([], []).size).toBe(0);
    expect(forceLayout(['x'], [], { w: 100, h: 100 }).get('x')).toEqual({ x: 50, y: 50 });
  });
});

describe('horizontal fixtures are valid and stay drafts/fixtures', () => {
  const read = (p: string) => parse(readFileSync(new URL(`../src/content/${p}`, import.meta.url), 'utf8'));
  it('pattern, entities, glossary, paths and image fixtures parse', () => {
    expect(patternSchema.parse(read('patterns/_fixture-pattern/meta.yaml')).status).toBe('draft');
    for (const e of ['_fixture-demo-b', '_fixture-demo-c'])
      expect(entitySchema.parse(read(`entities/${e}/meta.yaml`)).status).toBe('draft');
    for (const g of ['_fixture-term', '_fixture-term-b']) glossarySchema.parse(read(`glossary/${g}.yaml`));
    for (const p of ['_fixture-path-vertical', '_fixture-path-horizontal']) pathSchema.parse(read(`paths/${p}.yaml`));
    imageSchema.parse(read('images/_fixture-grid.yaml'));
  });
});
