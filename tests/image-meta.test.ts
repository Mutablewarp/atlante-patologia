import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { parse } from 'yaml';
import { imageSchema } from '../src/lib/schema.ts';
import { STAINS, attributionFor, fileFor, groupMembers, licenseName, powerOf, scaleBar, stainCode } from '../src/lib/image-meta.ts';

describe('stainCode', () => {
  it.each([
    ['H&E', 'HE'],
    ['haematoxylin and eosin', 'HE'],
    ['ematossilina-eosina', 'HE'],
    ['PAS', 'PAS'],
    ['PAS-D', 'PAS-D'],
    ['PAS with diastase digestion (D-PAS)', 'PAS-D'],
    ["Perls' Prussian blue", 'Perls'],
    ['Perls Prussian blue (iron stain)', 'Perls'],
    ['von Kossa', 'von Kossa'],
    ['Alizarin red S', 'Alizarin red'],
    ['Congo red under polarised light', 'Congo red'],
    ["Masson's trichrome", 'Masson trichrome'],
    ['reticulin (silver)', 'reticulin'],
    ['Oil Red O on a frozen section', 'Oil Red O'],
    ['Sudan black', 'Sudan'],
    ['Ziehl-Neelsen', 'Ziehl-Neelsen'],
    ['Grocott methenamine silver', 'Grocott'],
    ['Gram', 'Gram'],
    ['Giemsa', 'Giemsa'],
    ['immunohistochemistry for ubiquitin (brown), haematoxylin counterstain (blue)', 'IHC:ubiquitin'],
    ['immunohistochemistry for alpha-synuclein (brown), Nissl counterstain (blue)', 'IHC:alpha-synuclein'],
    ['IHC: CD20', 'IHC:CD20'],
    ['p62 immunohistochemistry', 'IHC:p62'],
  ])('%s → %s', (text, code) => expect(stainCode(text)).toBe(code));

  it('several stains, unknown stains and placeholders are "other"; no stain is undefined', () => {
    expect(stainCode('H&E (left), trichrome (right)')).toBe('other');
    expect(stainCode('H&E (a) and p62 immunohistochemistry (e); Congo red (b)')).toBe('other');
    expect(stainCode('transmission electron microscopy (TEM)')).toBe('other');
    expect(stainCode('—')).toBe('other');
    expect(stainCode(undefined)).toBeUndefined();
    expect(stainCode('  ')).toBeUndefined();
  });

  it('maps every stain in the current image files to the controlled list', () => {
    const ok = (c: string) => (STAINS as readonly string[]).includes(c) || c === 'other' || /^IHC:\S+$/.test(c);
    const dir = new URL('../src/content/images/', import.meta.url);
    for (const f of readdirSync(dir).filter((n) => n.endsWith('.yaml'))) {
      const img = imageSchema.parse(parse(readFileSync(new URL(f, dir), 'utf8')));
      if (img.stain) expect(ok(stainCode(img.stain)!), `${f}: ${img.stain}`).toBe(true);
    }
  });
});

describe('powerOf', () => {
  it('reads the first relative power and treats intermediate as medium', () => {
    expect(powerOf('low power (×10)')).toBe('low');
    expect(powerOf('intermediate power')).toBe('medium');
    expect(powerOf('medium power (20× objective, both panels)')).toBe('medium');
    expect(powerOf('ultrastructural (high power)')).toBe('high');
    expect(powerOf('low to intermediate power')).toBe('low');
    expect(powerOf('40× objective')).toBeUndefined();
    expect(powerOf(undefined)).toBeUndefined();
  });
});

describe('groupMembers', () => {
  const all = [
    { id: 'a-high', group: 'g', magnification: 'high power' },
    { id: 'a-low', group: 'g', magnification: 'low power' },
    { id: 'a-none', group: 'g' },
    { id: 'a-med', group: 'g', magnification: 'intermediate power' },
    { id: 'other', group: 'h', magnification: 'low power' },
    { id: 'lone', magnification: 'low power' },
  ];
  it('collects the group low to high power, unknown power last', () => {
    expect(groupMembers(all, all[0]!).map((i) => i.id)).toEqual(['a-low', 'a-med', 'a-high', 'a-none']);
  });
  it('an image without a group is alone, and a group never mixes with another', () => {
    expect(groupMembers(all, all[5]!).map((i) => i.id)).toEqual(['lone']);
    expect(groupMembers(all, all[4]!).map((i) => i.id)).toEqual(['other']);
  });
  it('keeps the image even when the list does not hold it (drafts filtered out)', () => {
    const solo = { id: 'x', group: 'g' };
    expect(groupMembers([], solo)).toEqual([solo]);
  });
});

describe('scaleBar', () => {
  it('picks the longest 1-2-5 length that fits', () => {
    // 0.25 µm/px, 1200 px shown at 600 CSS px → 0.5 µm per CSS px → at most 60 µm in 120 px → 50 µm = 100 px.
    expect(scaleBar(0.25, 1200, 600)).toEqual({ um: 50, px: 100 });
    // Zoomed 6×: 0.0833 µm per CSS px → at most 10 µm → 10 µm = 120 px.
    const z = scaleBar(0.25, 1200, 3600)!;
    expect(z.um).toBe(10);
    expect(z.px).toBeCloseTo(120);
  });
  it('the bar is between half and the full maximum width', () => {
    for (const shown of [100, 333, 777, 1500, 4000]) {
      const b = scaleBar(0.5, 2000, shown)!;
      expect(b.px).toBeGreaterThan(59);
      expect(b.px).toBeLessThanOrEqual(120.0001);
    }
  });
  it('returns undefined without a usable mpp or width', () => {
    expect(scaleBar(0, 1200, 600)).toBeUndefined();
    expect(scaleBar(Number.NaN, 1200, 600)).toBeUndefined();
    expect(scaleBar(0.25, 1200, 0)).toBeUndefined();
  });
});

describe('image schema: study fields', () => {
  const base = parse(readFileSync(new URL('../src/content/images/_fixture-grid-b.yaml', import.meta.url), 'utf8'));
  it('the grouped fixture parses with group, objective, mpp, section, orientation and lookFor', () => {
    const img = imageSchema.parse(base);
    expect(img).toMatchObject({ group: 'fixture-grid-set', objective: '40x', mpp: 0.25, section: 'paraffin' });
    expect(img.lookFor?.en).toBeTruthy();
  });
  it('rejects values outside the controlled lists', () => {
    expect(() => imageSchema.parse({ ...base, section: 'sideways' })).toThrow();
    expect(() => imageSchema.parse({ ...base, objective: '13x' })).toThrow();
    expect(() => imageSchema.parse({ ...base, mpp: 0 })).toThrow();
    expect(() => imageSchema.parse({ ...base, group: 'Not Kebab' })).toThrow();
    expect(() => imageSchema.parse({ ...base, lookFor: { it: 'solo italiano' } })).toThrow();
  });
});

describe('original diagrams in both languages', () => {
  const dir = new URL('../src/content/images/', import.meta.url);
  const assets = new URL('../src/assets/images/', import.meta.url);
  const ours = readdirSync(dir)
    .filter((f) => f.endsWith('.yaml') && !f.startsWith('_'))
    .map((f) => imageSchema.parse(parse(readFileSync(new URL(f, dir), 'utf8'))))
    .filter((i) => i.license === 'original');
  it('every published diagram of ours with text in the drawing has an Italian copy, and each language shows its own', () => {
    expect(ours.length).toBeGreaterThan(0);
    for (const img of ours.filter((i) => i.file.endsWith('.svg'))) {
      expect(img.fileIt, img.id).toBe(img.file.replace(/\.svg$/, '.it.svg'));
      expect(fileFor(img, 'it')).toBe(img.fileIt);
      expect(fileFor(img, 'en')).toBe(img.file);
      const it = readFileSync(new URL(img.fileIt!, assets), 'utf8');
      const en = readFileSync(new URL(img.file, assets), 'utf8');
      // Same drawing, other words: as many labels, and none of the English ones left (names and symbols aside).
      const labels = (svg: string) => [...svg.matchAll(/<text\b[^>]*>([^<]*)<\/text>/g)].map((m) => m[1]!);
      expect(labels(it).length, img.id).toBe(labels(en).length);
      const kept = labels(it).filter((t, k) => t === labels(en)[k] && /[a-z]{4,}/.test(t) && !/^[A-Z][\w-]*,? ?(?:[A-Z]\w*,? ?)*$/.test(t));
      expect(kept, img.id).toEqual([]);
    }
  });
  it('credits us in the page language under our licence name', () => {
    for (const img of ours) {
      expect(typeof img.attributionText, img.id).toBe('object');
      expect(attributionFor(img.attributionText, 'it'), img.id).toMatch(/Atlante di Patologia/);
      expect(licenseName(img.license, 'it')).toBe('CC BY-SA 4.0');
    }
    expect(attributionFor('Mikael Häggström, CC0 1.0', 'it')).toBe('Mikael Häggström, CC0 1.0');
    expect(licenseName('CC-BY-SA-3.0', 'en')).toBe('CC BY-SA 3.0');
    expect(licenseName('CC0-1.0', 'en')).toBe('CC0 1.0');
    expect(licenseName('PD', 'it')).toBe('pubblico dominio');
  });
  it('rejects an English-only credit on our own image, and an Italian copy of a third-party one', () => {
    const base = parse(readFileSync(new URL('g01-apoptosis-pathways.yaml', dir), 'utf8'));
    expect(imageSchema.safeParse(base).success).toBe(true);
    expect(imageSchema.safeParse({ ...base, attributionText: 'Original diagram' }).success).toBe(false);
    expect(imageSchema.safeParse({ ...base, license: 'CC0-1.0' }).success).toBe(false);
  });
});
