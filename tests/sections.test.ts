import { describe, expect, it } from 'vitest';
import { splitSections } from '../src/lib/sections.ts';
import { SECTIONS } from '../src/i18n/sections.ts';

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
