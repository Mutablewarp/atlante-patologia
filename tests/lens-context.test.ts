import { describe, expect, it } from 'vitest';
import { lensMarkup, type LensData } from '../src/lib/lens-context.ts';
import { dropClaimMarkers } from '../src/lib/crosslinks.ts';

// The markup is what the entity page used to render as <template>s (Breadcrumb, CardPager and the links at the end of the card).
const data: LensData = {
  base: '/atlante-patologia/it/',
  name: 'Necrosi coagulativa',
  s: {
    crumb: 'Percorso',
    atlas: 'Atlante',
    prevCard: 'Scheda precedente',
    nextCard: 'Scheda successiva',
    prevIn: 'Precedente in “{term}”',
    nextIn: 'Successivo in “{term}”',
  },
  c: {
    'system:heart': ['Apparato / organo', 'Cuore', ['hypertrophy', 'Ipertrofia'], ['fatty-change', 'Steatosi (degenerazione grassa)']],
    'pattern:necrosis-coagulative': ['Quadro morfologico', 'Necrosi coagulativa', ['gangrene', 'Gangrena'], null],
    'group:alone': ['Gruppo', 'A & B <1>', null, null],
  },
};

describe('lens context markup', () => {
  it('builds the breadcrumb, the pager and the end-of-card links of a context with both neighbours', () => {
    expect(lensMarkup(data, 'system:heart')).toEqual({
      crumb:
        '<nav class="breadcrumb" aria-label="Percorso"><ol><li><a href="/atlante-patologia/it/atlas/">Atlante</a></li><li><a href="/atlante-patologia/it/atlas/system/">Apparato / organo</a></li><li><a href="/atlante-patologia/it/atlas/system/heart/">Cuore</a></li><li><span aria-current="page">Necrosi coagulativa</span></li></ol></nav>' +
        '<p class="pager" data-pagefind-ignore><a href="/atlante-patologia/it/e/hypertrophy/?via=system:heart"><span aria-hidden="true">← </span><span class="visually-hidden">Scheda precedente: </span>Ipertrofia</a><span aria-hidden="true">·</span><a href="/atlante-patologia/it/e/fatty-change/?via=system:heart"><span class="visually-hidden">Scheda successiva: </span>Steatosi (degenerazione grassa)<span aria-hidden="true"> →</span></a></p>',
      nav: '<nav class="prev-next" aria-label="Cuore"><a rel="prev" href="/atlante-patologia/it/e/hypertrophy/?via=system:heart"><span class="small muted">Precedente in “Cuore”</span><span>← Ipertrofia</span></a><a rel="next" href="/atlante-patologia/it/e/fatty-change/?via=system:heart" data-name="Steatosi (degenerazione grassa)"><span class="small muted">Successivo in “Cuore”</span><span>Steatosi (degenerazione grassa) →</span></a></nav>',
    });
  });

  it('leaves out the missing neighbour and its separator', () => {
    const { crumb, nav } = lensMarkup(data, 'pattern:necrosis-coagulative')!;
    expect(crumb).toContain('<p class="pager" data-pagefind-ignore><a href="/atlante-patologia/it/e/gangrene/?via=pattern:necrosis-coagulative"><span aria-hidden="true">← </span>');
    expect(crumb).not.toContain('·');
    expect(crumb).toContain('<a href="/atlante-patologia/it/atlas/pattern/necrosis-coagulative/">Necrosi coagulativa</a>');
    expect(nav).toBe(
      '<nav class="prev-next" aria-label="Necrosi coagulativa"><a rel="prev" href="/atlante-patologia/it/e/gangrene/?via=pattern:necrosis-coagulative"><span class="small muted">Precedente in “Necrosi coagulativa”</span><span>← Gangrena</span></a></nav>',
    );
  });

  it('renders no pager and no links when the card is alone in its list, and escapes the labels', () => {
    const { crumb, nav } = lensMarkup(data, 'group:alone')!;
    expect(crumb).not.toContain('pager');
    expect(crumb).toContain('>A &#38; B &#60;1&#62;</a>');
    expect(nav).toBe('');
  });

  it('knows no context it was not given', () => {
    expect(lensMarkup(data, 'system:nowhere')).toBeUndefined();
    expect(lensMarkup(data, '')).toBeUndefined();
    expect(lensMarkup(data, 'constructor')).toBeUndefined(); // ?via= comes from the address bar
  });
});

describe('claim markers', () => {
  it('are dropped from the page HTML, and other comments stay', () => {
    expect(dropClaimMarkers('<p>A.<!--c:x-c001--> B.<!-- c:x-c002 --> C. <!-- note --></p>')).toBe('<p>A. B. C. <!-- note --></p>');
  });
});
