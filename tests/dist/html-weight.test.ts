/**
 * HTML weight budgets (plan I-6, ARCHITECTURE §8). The bytes of the built HTML of a card page, a pattern page and a
 * pathway page, 1 kB = 1000 bytes. `node scripts/html-weight.mjs` prints what the bytes are made of.
 *
 * Card page: at most 110 kB, the plan target for a card of at most 1,300 words (measured 2026-11-12, 26 cards in both
 * languages: median 95.4 kB, heaviest 104.4 kB without its pathway block). A card that embeds a pathway adds that block:
 * at most 28 kB each (measured 26.9 kB). Pattern and pathway pages: the measured maximum plus 5 %.
 *
 * The chapter index in the sidebar lists every published card, about 90 bytes each, so each new card adds that to every
 * card page: this budget has room for about 60 cards in all. See ARCHITECTURE §8 before raising a limit.
 */
import { describe, expect, it } from 'vitest';
import { BASE, isEntity, pages } from './lib.ts';

const KB = 1000;
const ENTITY_MAX = 110 * KB;
const PATHWAY_BLOCK_MAX = 28 * KB;
const PATTERN_MAX = 91 * KB; // measured 86.3 kB
const PATHWAY_MAX = 56 * KB; // measured 52.8 kB
const all = pages();
const bytes = (s: string) => Buffer.byteLength(s);
const kind = (re: RegExp) => all.filter((p) => re.test(p.url));
const isPattern = /^\/atlante-patologia\/(it|en)\/pattern\/[^/]+\/$/;
const isPathway = /^\/atlante-patologia\/(it|en)\/pathways\/[^/]+\/$/;

function overBudget(list: typeof all, limit: (html: string) => number): string[] {
  expect(list.length).toBeGreaterThan(0);
  return list.filter((p) => bytes(p.html) > limit(p.html)).map((p) => `${p.url.replace(BASE, '/')}: ${(bytes(p.html) / KB).toFixed(1)} kB > ${(limit(p.html) / KB).toFixed(1)} kB`);
}

describe('HTML weight', () => {
  it(`a card page is at most ${ENTITY_MAX / KB} kB, plus ${PATHWAY_BLOCK_MAX / KB} kB for each pathway it embeds`, () => {
    const entities = all.filter((p) => isEntity(p.url));
    const heaviest = Math.max(...entities.map((p) => bytes(p.html)));
    console.info(`heaviest card page: ${(heaviest / KB).toFixed(1)} kB (${entities.length} card pages)`);
    expect(overBudget(entities, (html) => ENTITY_MAX + PATHWAY_BLOCK_MAX * (html.match(/<section class="entity-pathway"/g)?.length ?? 0))).toEqual([]);
  });

  it(`a pattern page is at most ${PATTERN_MAX / KB} kB and a pathway page at most ${PATHWAY_MAX / KB} kB`, () => {
    expect(overBudget(kind(isPattern), () => PATTERN_MAX)).toEqual([]);
    expect(overBudget(kind(isPathway), () => PATHWAY_MAX)).toEqual([]);
  });

  // The claim markers are for the content gates, which read them from the Markdown (D069).
  it('no page carries a claim marker comment', () => {
    expect(all.filter((p) => /<!--\s*c:/.test(p.html)).map((p) => p.url)).toEqual([]);
  });

  // What the weight work must not cost: the notice at first launch, the disclaimer in the footer, the language
  // alternates and the Pagefind body.
  it('card, pattern and pathway pages keep the first-launch notice, the footer disclaimer, the alternates and the search body', () => {
    const lost: string[] = [];
    for (const p of [...all.filter((x) => isEntity(x.url)), ...kind(isPattern), ...kind(isPathway)]) {
      const has = (needle: string | RegExp) => (typeof needle === 'string' ? p.html.includes(needle) : needle.test(p.html));
      for (const [what, needle] of [
        ['first-launch notice', 'data-first-notice'],
        ['footer disclaimer', 'class="footer-disclaimer"'],
        ['AI notice', 'data-ai-notice'],
        ['hreflang it', /<link rel="alternate" hreflang="it"/],
        ['hreflang en', /<link rel="alternate" hreflang="en"/],
        ['hreflang x-default', /<link rel="alternate" hreflang="x-default"/],
        ['Pagefind body', 'data-pagefind-body'],
      ] as const)
        if (!has(needle)) lost.push(`${p.url}: ${what}`);
    }
    expect(lost).toEqual([]);
  });
});
