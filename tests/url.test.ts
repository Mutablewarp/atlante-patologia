import { describe, expect, it } from 'vitest';
import { joinBase, stripLang } from '../src/lib/url.ts';

describe('url helper', () => {
  const base = '/atlante-patologia/';
  it('prefixes the base without double slashes and adds trailing slashes to routes', () => {
    expect(joinBase(base)).toBe('/atlante-patologia/');
    expect(joinBase(base, '/it/atlas')).toBe('/atlante-patologia/it/atlas/');
    expect(joinBase('/atlante-patologia', 'it//atlas/')).toBe('/atlante-patologia/it/atlas/');
    expect(joinBase(base, 'favicon.svg')).toBe('/atlante-patologia/favicon.svg');
    expect(joinBase(base, 'it/search?q=x#r')).toBe('/atlante-patologia/it/search/?q=x#r');
    expect(joinBase('/', 'en/')).toBe('/en/');
  });
  it('strips base and language for the language switch', () => {
    expect(stripLang('/atlante-patologia/it/atlas/system/', base)).toBe('atlas/system/');
    expect(stripLang('/atlante-patologia/en/', base)).toBe('');
    expect(stripLang('/atlante-patologia/404/', base)).toBe('404/');
  });
});
