import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { parse } from 'yaml';
import { entitySchema, moduleSchema, sourceSchema, taxonomySchema } from '../src/lib/schema.ts';

const read = (p: string) => parse(readFileSync(new URL(`../src/content/${p}`, import.meta.url), 'utf8'));

describe('content data files match the schemas', () => {
  it('modules.yaml has all 34 modules g01..o34 in order', () => {
    const mods = moduleSchema.array().parse(read('modules.yaml'));
    expect(mods).toHaveLength(34);
    expect(mods[0]!.id).toBe('g01');
    expect(mods.at(-1)!.id).toBe('o34');
    expect(mods.map((m) => m.order)).toEqual(mods.map((_, i) => i + 1));
  });
  it('taxonomy files are valid and term ids are unique per lens', () => {
    const dir = new URL('../src/content/taxonomy/', import.meta.url);
    const files = readdirSync(dir);
    expect(files).toHaveLength(6);
    for (const f of files) {
      const tax = taxonomySchema.parse(read(`taxonomy/${f}`));
      const ids = tax.terms.map((t) => t.id);
      expect(new Set(ids).size).toBe(ids.length);
      for (const t of tax.terms) if (t.parent) expect(ids).toContain(t.parent);
    }
  });
  it('sources.yaml is valid', () => {
    const src = sourceSchema.array().parse(read('sources.yaml'));
    // content modules add article sources over time; every article must be traceable by DOI or PMID
    expect(src.filter((s) => s.kind === 'article' && s.doi).length).toBeGreaterThanOrEqual(8);
    expect(src.filter((s) => s.kind === 'article' && !s.doi && !s.pmid).map((s) => s.id)).toEqual([]);
  });
  it('the fixture entity is valid and stays a draft', () => {
    const fx = entitySchema.parse(read('entities/_fixture-demo/meta.yaml'));
    expect(fx.status).toBe('draft');
  });
  it('rejects an entity with fewer than 3 lenses', () => {
    const fx = read('entities/_fixture-demo/meta.yaml');
    const bad = { ...fx, lenses: { system: ['general'], group: ['degenerative'] } };
    expect(entitySchema.safeParse(bad).success).toBe(false);
  });
});

describe('standards and entity classification (WHO watch)', () => {
  const all = () => sourceSchema.array().parse(read('sources.yaml'));
  const std = { id: 'x-std', title: 'T', year: 2026, kind: 'standard', existsVerified: { via: 'publisher', date: '2026-11-03' } };

  it('every supersedes points to an existing standard of the same series and an older edition', () => {
    const src = all();
    const byId = new Map(src.map((s) => [s.id, s]));
    const withSup = src.filter((s) => s.supersedes);
    expect(withSup.length).toBeGreaterThanOrEqual(4);
    for (const s of withSup) {
      const old = byId.get(s.supersedes!);
      expect(old, `${s.id} supersedes unknown ${s.supersedes}`).toBeDefined();
      expect(old!.kind).toBe('standard');
      expect(old!.series).toBe(s.series);
      expect(old!.edition!).toBeLessThan(s.edition!);
    }
  });
  it('lists the verified WHO status: 5th ed. complete, 6th-ed. Digestive in print, three 6th-ed. betas', () => {
    const who = all().filter((s) => s.series === 'WHO Classification of Tumours');
    expect(who.filter((s) => s.edition === 5).map((s) => s.volume).sort((a, b) => a! - b!)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
    expect(who.find((s) => s.id === 'who-5e-dig')!.status).toBe('superseded');
    expect(who.find((s) => s.id === 'who-6e-dig')).toMatchObject({ status: 'print', volume: 1, isbn: '978-92-832-4548-3' });
    expect(who.filter((s) => s.status === 'online-beta').map((s) => s.id).sort()).toEqual(['who-6e-breast', 'who-6e-fgt', 'who-6e-stb']);
  });
  it('accepts the new standard fields and rejects them on other kinds', () => {
    expect(sourceSchema.safeParse({ ...std, series: 'S', edition: 6, volume: 1, status: 'online-beta', supersedes: 'y', isbn: '978-92-832-4548-3' }).success).toBe(true);
    expect(sourceSchema.safeParse({ ...std, kind: 'article', status: 'print' }).success).toBe(false);
    expect(sourceSchema.safeParse({ ...std, status: 'draft' }).success).toBe(false);
    expect(sourceSchema.safeParse({ ...std, supersedes: 'x-std' }).success).toBe(false);
    expect(sourceSchema.safeParse({ ...std, isbn: '9789283245483' }).success).toBe(false);
  });
  it('the fixture carries a classification block; the block is optional and needs a date', () => {
    const fx = entitySchema.parse(read('entities/_fixture-demo/meta.yaml'));
    expect(fx.classification).toEqual({ source: 'who-5e-dig', checked: new Date('2026-11-03') });
    const raw = read('entities/_fixture-demo/meta.yaml');
    expect(entitySchema.safeParse({ ...raw, classification: undefined }).success).toBe(true);
    expect(entitySchema.safeParse({ ...raw, classification: { source: 'who-5e-dig' } }).success).toBe(false);
    expect(entitySchema.safeParse({ ...raw, classification: { source: 'who-5e-dig', volume: 0, checked: '2026-11-03' } }).success).toBe(false);
  });
});
