import { describe, expect, it } from 'vitest';
import { splitSections } from '../src/lib/sections.ts';
import { QUICK_CHECK, SECTIONS, sectionIdForTitle, sectionTitle } from '../src/i18n/sections.ts';

describe('entity body sections', () => {
  it('maps canonical titles in either language to stable anchors', () => {
    const html =
      '<!-- c --><h2 id="x">Definizione ed epidemiologia</h2><p>a</p><h2>Errori comuni e trappole d’esame</h2><ul><li>b</li></ul>' +
      '<h2 id="y">Microscopic morphology</h2><p>c</p>';
    const out = splitSections(html);
    expect([...out.sections.keys()]).toEqual(['definition', 'traps', 'micro']);
    expect(out.sections.get('traps')).toBe('<ul><li>b</li></ul>');
    expect(out.unknown).toEqual([]);
  });
  it('reports non-canonical H2 titles', () => {
    expect(splitSections('<h2>Random</h2><p>x</p>').unknown).toEqual(['Random']);
  });
  it('has 13 unique anchors', () => {
    expect(new Set(SECTIONS.map((s) => s.id)).size).toBe(13);
  });
});

describe('sectionTitle (technique cards keep the 13 ids but show their own titles)', () => {
  const LANGS = ['en', 'it'] as const;
  const TECHNIQUE = {
    definition: ['Principle and aims', 'Principio e scopi'],
    etiology: ['Indications', 'Indicazioni'],
    pathogenesis: ['Steps of the method', 'Fasi del metodo'],
    gross: ['Gross handling', 'Gestione macroscopica'],
    micro: ['What the slide or smear shows', 'Cosa mostra il vetrino o lo striscio'],
    ancillary: ['Related tests', 'Test correlati'],
    clinical: ['Clinical use', 'Uso clinico'],
    diagnosis: ['Interpretation and reporting', 'Interpretazione e refertazione'],
    prognosis: ['Limits and cost of errors', 'Limiti e costo degli errori'],
    differential: ['Compared with other techniques', 'Confronto con altre tecniche'],
  } as const;

  it('gives a technique card the agreed titles, EN and IT, in headings and in the contents list', () => {
    for (const [id, [en, it]] of Object.entries(TECHNIQUE)) {
      expect(sectionTitle(id, 'technique', 'en')).toBe(en);
      expect(sectionTitle(id, 'technique', 'it')).toBe(it);
      expect(sectionTitle(id, 'technique', 'en', true)).toBe(en);
      expect(sectionTitle(id, 'technique', 'it', true)).toBe(it);
    }
  });
  it('leaves high-yield, traps, mnemonics and the quick check alone on a technique card', () => {
    for (const lang of LANGS)
      for (const s of [...SECTIONS.filter((x) => !(x.id in TECHNIQUE)), QUICK_CHECK]) {
        expect(sectionTitle(s.id, 'technique', lang)).toBe(s.title[lang]);
        expect(sectionTitle(s.id, 'technique', lang, true)).toBe(s.short[lang]);
      }
  });
  it('changes nothing for every other kind (or no kind): title, and short label for the contents list', () => {
    for (const kind of ['disease', 'lesion', 'process', 'concept', undefined])
      for (const lang of LANGS)
        for (const s of [...SECTIONS, QUICK_CHECK]) {
          expect(sectionTitle(s.id, kind, lang)).toBe(s.title[lang]);
          expect(sectionTitle(s.id, kind, lang, true)).toBe(s.short[lang]);
        }
  });
  it('shows 13 distinct titles per language on a technique card', () => {
    for (const lang of LANGS) expect(new Set(SECTIONS.map((s) => sectionTitle(s.id, 'technique', lang))).size).toBe(13);
  });
  it('keeps the ids and the canonical H2 titles of the files: splitSections never sees a technique title', () => {
    expect(Object.keys(TECHNIQUE).every((id) => SECTIONS.some((s) => s.id === id))).toBe(true);
    for (const [en, it] of Object.values(TECHNIQUE)) {
      expect(sectionIdForTitle(en)).toBeUndefined();
      expect(sectionIdForTitle(it)).toBeUndefined();
    }
  });
  it('falls back to the id for a section it does not know', () => {
    expect(sectionTitle('nope', 'technique', 'en')).toBe('nope');
    expect(sectionTitle('nope', undefined, 'it', true)).toBe('nope');
  });
});
