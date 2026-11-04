/**
 * 3D pathways (O9): schemas, the claim ledger gate for pathway step text, and
 * the links between pathways, structures, structure files and posters.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { ledgerSchema, NEEDS_SECOND_SOURCE, pathwaySchema, sourceSchema, structureSchema, type Pathway, type Structure } from '../src/lib/schema.ts';
import { claimMarkers } from './content/markdown.ts';

const root = new URL('../', import.meta.url);
const read = (p: string) => parse(readFileSync(new URL(p, root), 'utf8'));
const yamls = (dir: string) => readdirSync(new URL(dir, root)).filter((f) => f.endsWith('.yaml'));

const structures = new Map<string, Structure>(yamls('src/content/structures/').map((f) => [f.replace(/\.yaml$/, ''), structureSchema.parse(read(`src/content/structures/${f}`))]));
const pathways: Pathway[] = yamls('src/content/pathways/').map((f) => pathwaySchema.parse(read(`src/content/pathways/${f}`)));
const sources = new Set(sourceSchema.array().parse(read('src/content/sources.yaml')).map((s) => s.id));
const entities = new Set(readdirSync(new URL('src/content/entities/', root)).filter((d) => !d.startsWith('_')));

describe('structure schema', () => {
  const good = read('src/content/structures/1pau.yaml');
  it('accepts every committed structure file, named after its id', () => {
    expect(structures.size).toBeGreaterThan(0);
    for (const [file, s] of structures) expect(s.id).toBe(file);
  });
  it('rejects the /assembly BinaryCIF query, a missing citation id, a non-CC0 licence and unknown shown chains', () => {
    expect(structureSchema.safeParse({ ...good, modelServerQuery: 'assembly?name=1&encoding=bcif' }).success).toBe(false);
    expect(structureSchema.safeParse({ ...good, citation: { ...good.citation, doi: undefined, pmid: undefined } }).success).toBe(false);
    expect(structureSchema.safeParse({ ...good, license: 'CC-BY-4.0' }).success).toBe(false);
    expect(structureSchema.safeParse({ ...good, show: ['Z'] }).success).toBe(false);
    expect(structureSchema.safeParse({ ...good, caveats: { it: 'solo italiano' } }).success).toBe(false);
  });
  it('points at a committed gzip file of the recorded size', () => {
    for (const s of structures.values()) {
      const file = new URL(`public/${s.file}`, root);
      expect(existsSync(file), s.file).toBe(true);
      expect(statSync(file).size, s.file).toBe(s.bytes);
      const head = readFileSync(file).subarray(0, 2);
      expect([...head], s.file).toEqual([0x1f, 0x8b]);
    }
  });
});

describe('pathway schema', () => {
  const good = read('src/content/pathways/intrinsic-apoptosis.yaml');
  it('rejects duplicate step ids, a highlight without a structure and a one-language step', () => {
    const [a, b] = good.steps;
    expect(pathwaySchema.safeParse({ ...good, steps: [a, { ...b, id: a.id }] }).success).toBe(false);
    expect(pathwaySchema.safeParse({ ...good, steps: [a, { ...b, structure: undefined, highlight: { chains: ['A'], label: { it: 'x', en: 'x' } } }] }).success).toBe(false);
    expect(pathwaySchema.safeParse({ ...good, steps: [{ ...a, text: { en: a.text.en } }, b] }).success).toBe(false);
    expect(pathwaySchema.safeParse({ ...good, steps: [a, { ...b, highlight: { label: { it: 'x', en: 'x' } } }] }).success).toBe(false);
  });
});

describe('pathway content gate', () => {
  for (const p of pathways) {
    describe(p.id, () => {
      const ledgerFile = `docs/ledger/pathway-${p.id}.yaml`;
      it('belongs to an existing entity and cites known sources', () => {
        expect(entities.has(p.entity)).toBe(true);
        for (const s of p.sources) expect(sources.has(s.source), s.source).toBe(true);
      });
      it('has the same claim markers in Italian and English, and every sentence ends with one', () => {
        for (const s of p.steps) {
          expect([...claimMarkers(s.text.it)], s.id).toEqual([...claimMarkers(s.text.en)]);
          expect(claimMarkers(s.text.en).size, s.id).toBeGreaterThan(0);
          for (const lang of ['it', 'en'] as const) expect(s.text[lang].trim().endsWith('-->'), `${s.id}/${lang}`).toBe(true);
        }
      });
      it(`matches its ledger ${ledgerFile} one to one`, () => {
        const ledger = ledgerSchema.parse(read(ledgerFile));
        expect(ledger.entity).toBe(`pathway-${p.id}`);
        const markers = p.steps.flatMap((s) => [...claimMarkers(s.text.en)].map((c) => [c, s.id] as const));
        const rows = new Map(ledger.claims.map((c) => [c.claimId, c]));
        expect(markers.map(([c]) => c).sort()).toEqual([...rows.keys()].sort());
        for (const [claim, step] of markers) expect(rows.get(claim)!.section, claim).toBe(step);
        for (const c of ledger.claims) {
          expect(c.status, c.claimId).not.toBe('contradicted');
          expect(sources.has(c.sourceRef.source), c.claimId).toBe(true);
          if (NEEDS_SECOND_SOURCE.has(c.status)) expect(sources.has(c.secondSource!.source), c.claimId).toBe(true);
        }
        // CONTENT_SCHEMA §8: a sources-differ row needs an aside in its step, in both languages, naming that claim.
        for (const c of ledger.claims.filter((x) => x.status === 'sources-differ')) {
          const step = p.steps.find((s) => s.id === c.section)!;
          for (const lang of ['it', 'en'] as const) expect(claimMarkers(step.sourcesDiffer?.[lang] ?? '').has(c.claimId), `${c.claimId}/${lang}`).toBe(true);
        }
        for (const s of p.steps) for (const id of claimMarkers(s.sourcesDiffer?.en ?? '')) expect(rows.get(id)?.status, `${s.id}: ${id}`).toBe('sources-differ');
      });
      it('uses known structures, highlights parts that exist in them, and has a poster for each', () => {
        for (const s of p.steps) {
          if (!s.structure) continue;
          const st = structures.get(s.structure);
          expect(st, s.structure).toBeDefined();
          expect(existsSync(new URL(`src/assets/structures/${s.structure}.png`, root)), `${s.structure}.png`).toBe(true);
          const chains = new Set(st!.chains.map((c) => c.id));
          for (const c of s.highlight?.chains ?? []) expect(chains.has(c), `${s.id}: chain ${c}`).toBe(true);
          const hetero = new Set(st!.chains.flatMap((c) => c.hetero ?? []));
          for (const r of s.highlight?.resn ?? []) expect(hetero.has(r), `${s.id}: ${r}`).toBe(true);
        }
      });
    });
  }
});
