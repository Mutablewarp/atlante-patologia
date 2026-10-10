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
    expect(src.filter((s) => s.kind === 'article' && s.doi)).toHaveLength(8);
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
