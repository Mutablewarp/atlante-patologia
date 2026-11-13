// Proves each content gate fails: a valid synthetic tree (tests/fixtures/content-gates) passes,
// and each single mutation of it produces a problem from the expected gate.
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { runGates, prerequisiteCycles, type Gate } from './gates.ts';
import { unmarkedNumericSentences } from './markdown.ts';
import { loadTree, type Tree, type Unit } from './tree.ts';

const base = loadTree(fileURLToPath(new URL('../fixtures/content-gates/', import.meta.url)));
type Any = any;
const meta = (u: Unit) => u.meta.data as Any;
const doc = (d: { data: unknown }) => d.data as Any;

/** Clone the fixture, apply one mutation, return the problems of `gate` as "file: message" strings. */
function fail(gate: Gate, mutate: (t: Tree) => void): string[] {
  const t = structuredClone(base);
  mutate(t);
  return runGates(t).problems.filter((p) => p.gate === gate).map((p) => `${p.file}: ${p.message}`);
}
const alpha = (t: Tree) => t.entities.find((e) => e.id === 'fx-alpha')!;
const ledger = (t: Tree, id = 'fx-alpha') => doc(t.ledgers.get(id)!);
/** Adds a draft copy of fx-alpha as fx-beta (drafts need no ledger). */
function addBeta(t: Tree): Unit {
  const b = structuredClone(alpha(t));
  Object.assign(b, { id: 'fx-beta', dir: 'src/content/entities/fx-beta' });
  b.meta.path = 'src/content/entities/fx-beta/meta.yaml';
  Object.assign(meta(b), { id: 'fx-beta', status: 'draft', relations: [], sites: [] });
  t.entities.push(b);
  return b;
}

describe('content gates: synthetic fixture', () => {
  it('the valid fixture passes every gate and is fresh', () => {
    const r = runGates(base);
    expect(r.problems).toEqual([]);
    expect(r.stale).toEqual([]);
  });

  describe('parity', () => {
    it('fails when it.md is missing', () => expect(fail('parity', (t) => delete alpha(t).it)).toEqual([expect.stringMatching(/it\.md: missing/)]));
    it('fails when en.md is missing', () => expect(fail('parity', (t) => delete alpha(t).en)).toEqual([expect.stringMatching(/en\.md: missing/)]));
    it('still checks the structure of en.md when it.md is missing (the author stage of scripts/agent)', () =>
      expect(
        fail('parity', (t) => {
          delete alpha(t).it;
          alpha(t).en = alpha(t).en!.replace('## Mnemonics\n', '');
        }),
      ).toEqual([expect.stringMatching(/it\.md: missing/), expect.stringMatching(/en\.md: .*#13: expected "Mnemonics"/)]));
    it('fails when a canonical section is missing', () =>
      expect(fail('parity', (t) => void (alpha(t).en = alpha(t).en!.replace('## Mnemonics\n', '')))).toEqual([
        expect.stringMatching(/en\.md: .*#13: expected "Mnemonics"/),
      ]));
    it('fails when sections are out of order or use the other language title', () =>
      expect(fail('parity', (t) => void (alpha(t).it = alpha(t).it!.replace('## Patogenesi', '## Pathogenesis')))).toEqual([
        expect.stringMatching(/it\.md: .*#3: expected "Patogenesi", got "Pathogenesis"/),
      ]));
    it('fails when the differential has no table or high-yield is not a bold bullet list', () => {
      expect(fail('parity', (t) => void (alpha(t).en = alpha(t).en!.replace('| [[fx-planned]] | none |', 'none').replace(/\| Entry.*\n\| ---.*\n/, '')))).toEqual([
        expect.stringMatching(/en\.md: differential diagnosis needs a Markdown table/),
      ]);
      expect(fail('parity', (t) => void (alpha(t).it = alpha(t).it!.replace('- Termine **segnaposto**.', '- Termine segnaposto.')))).toEqual([
        expect.stringMatching(/it\.md: high-yield summary needs \*\*bold\*\*/),
      ]);
    });
    it('fails when claim marker sets differ', () =>
      expect(fail('parity', (t) => void (alpha(t).it = alpha(t).it!.replace('<!--c:fx-alpha-c002-->', '')))).toEqual([
        expect.stringMatching(/it\.md: claim markers missing.*fx-alpha-c002/),
      ]));
    it('fails when pattern bodies have different section counts', () =>
      expect(fail('parity', (t) => void (t.patterns[0]!.it = t.patterns[0]!.it!.replace('## Trappole', 'Trappole')))).toHaveLength(1));
    it('reports a stale translation as a warning, not a problem', () => {
      const t = structuredClone(base);
      alpha(t).en += '\nEdited.\n';
      const r = runGates(t);
      expect(r.problems).toEqual([]);
      expect(r.stale).toEqual([expect.objectContaining({ file: 'src/content/entities/fx-alpha/it.md' })]);
    });
  });

  describe('ledger', () => {
    it('fails when a published entity has no ledger', () => expect(fail('ledger', (t) => t.ledgers.delete('fx-alpha'))).toContainEqual(expect.stringMatching(/missing ledger/)));
    it('fails when a marker has no row', () =>
      expect(
        fail('ledger', (t) => {
          alpha(t).en += 'Extra.<!--c:fx-alpha-c009-->\n';
          alpha(t).it += 'Extra.<!--c:fx-alpha-c009-->\n';
        }),
      ).toEqual([expect.stringMatching(/no ledger row for marker fx-alpha-c009/)]));
    it('fails when a row has no marker', () =>
      expect(fail('ledger', (t) => ledger(t).claims.push({ ...ledger(t).claims[0], claimId: 'fx-alpha-c099' }))).toEqual([
        expect.stringMatching(/fx-alpha-c099: row has no marker/),
      ]));
    it('fails on contradicted claims', () =>
      expect(fail('ledger', (t) => void (ledger(t).claims[0].status = 'contradicted'))).toEqual([expect.stringMatching(/contradicted/)]));
    it('fails when beyond-reference has no secondSource', () =>
      expect(fail('ledger', (t) => void (ledger(t).claims[0].status = 'beyond-reference'))).toContainEqual(expect.stringMatching(/secondSource is required/)));
    it('fails when secondSource is not in sources.yaml', () =>
      expect(
        fail('ledger', (t) => Object.assign(ledger(t).claims[0], { status: 'not-found-in-reference', secondSource: { source: 'nope', locator: 'p. 1' } })),
      ).toEqual([expect.stringMatching(/secondSource "nope"/)]));
    it('accepts not-found-in-reference with a verified second source', () =>
      expect(
        fail('ledger', (t) => Object.assign(ledger(t).claims[0], { status: 'not-found-in-reference', secondSource: { source: 'fx-article', locator: 'Table 1' } })),
      ).toEqual([]));
    it('fails when sources-differ has no aside in the text', () =>
      expect(
        fail('ledger', (t) => Object.assign(ledger(t).claims[0], { status: 'sources-differ', secondSource: { source: 'fx-article', locator: 'p. 2' } })),
      ).toEqual([expect.stringMatching(/sources-differ needs <aside/)]));
    it('fails when a pattern matrix cell has no marker, or different markers in the two languages', () => {
      const cell = (t: Tree) => meta(t.patterns[0]!).matrix.rows[0].cells[0];
      expect(fail('ledger', (t) => void (cell(t).en = 'placeholder'))).toEqual([expect.stringMatching(/fx-pattern\/meta\.yaml: matrix cell without a claim marker/)]);
      expect(fail('ledger', (t) => void (cell(t).it = 'segnaposto'))).toEqual([expect.stringMatching(/fx-pattern\/meta\.yaml: matrix cell markers differ between en and it/)]);
    });
    it('accepts a ledger row whose only marker is in a matrix cell', () =>
      expect(
        fail('ledger', (t) => {
          ledger(t, 'fx-pattern').claims.push({ ...ledger(t, 'fx-pattern').claims[0], claimId: 'fx-pattern-c002' });
          Object.assign(meta(t.patterns[0]!).matrix.rows[0].cells[0], { en: 'placeholder<!--c:fx-pattern-c002-->', it: 'segnaposto<!--c:fx-pattern-c002-->' });
        }),
      ).toEqual([]));
    it('fails when the page does not list a source its ledger relies on', () =>
      expect(
        fail('ledger', (t) => {
          Object.assign(ledger(t).claims[0], { status: 'beyond-reference', secondSource: { source: 'fx-article', locator: 'abstract' } });
          meta(alpha(t)).sources = meta(alpha(t)).sources.filter((s: Any) => s.source !== 'fx-article');
        }),
      ).toEqual([expect.stringMatching(/fx-alpha\/meta\.yaml: sources must list "fx-article"/)]));
    it('fails when a question cites an unknown claim', () =>
      expect(fail('ledger', (t) => void (doc(t.questions[0]!).claims = ['fx-alpha-c404']))).toEqual([expect.stringMatching(/fx-alpha-c404/)]));
  });

  describe('numbers', () => {
    it('fails on an unmarked numeric sentence', () =>
      expect(fail('numbers', (t) => void (alpha(t).it = alpha(t).it!.replace('Segnaposto.', 'Dura 3 giorni.')))).toEqual([
        expect.stringMatching(/it\.md: .*Dura 3 giorni/),
      ]));
    it('detects percentages and units, ignores marked sentences and plain digits', () => {
      expect(unmarkedNumericSentences('About 10% of cases. Size 2.5 cm.<!--c:x-c1--> Then 3 mg/dL <!--c:x-c2-->. Text 1b. Year 2020.')).toEqual([
        'About 10% of cases.',
      ]);
      expect(unmarkedNumericSentences('- lasts 2 weeks\n\n| a | 4 mm |\n| --- | --- |\n\n## 5 mm heading\n\n<!-- 7 mm in a comment -->')).toEqual(['lasts 2 weeks', '4 mm']);
      expect(unmarkedNumericSentences('Measures 5 mm. <!--c:x-c1-->\nNext 7 anni.<!--c:x-c2-->')).toEqual([]);
      // genus abbreviations do not split a sentence away from its marker
      expect(unmarkedNumericSentences('*C. perfringens* causes most cases (80% to 90%), with *C. novyi* in others.<!--c:x-c1-->')).toEqual([]);
      expect(unmarkedNumericSentences('*C. perfringens* causes 80% of cases. *C. novyi* the rest.<!--c:x-c1-->')).toEqual(['*C. perfringens* causes 80% of cases.']);
    });
  });

  describe('references', () => {
    it('fails on an unknown relation target', () =>
      expect(fail('references', (t) => meta(alpha(t)).relations.push({ type: 'mimics', target: 'ghost' }))).toEqual([expect.stringMatching(/unknown target "ghost"/)]));
    it('fails on a self-relation (schema)', () =>
      expect(fail('schema', (t) => meta(alpha(t)).relations.push({ type: 'mimics', target: 'fx-alpha' }))).toEqual([expect.stringMatching(/self-relation/)]));
    it('fails on contradictory directed pairs', () =>
      expect(
        fail('references', (t) => {
          meta(addBeta(t)).relations = [{ type: 'causes', target: 'fx-alpha' }];
          meta(alpha(t)).relations.push({ type: 'causes', target: 'fx-beta' });
        }),
      ).toEqual([expect.stringMatching(/contradictory relations/)]));
    it('fails on a prerequisite cycle', () =>
      expect(
        fail('references', (t) => {
          meta(addBeta(t)).prerequisites = ['fx-alpha'];
          meta(alpha(t)).prerequisites = ['fx-beta'];
        }),
      ).toEqual([expect.stringMatching(/prerequisite cycle/)]));
    it('finds each cycle once', () => {
      expect(prerequisiteCycles([{ id: 'a', prerequisites: ['b'] }, { id: 'b', prerequisites: ['c'] }, { id: 'c', prerequisites: ['a'] }])).toEqual([['a', 'b', 'c', 'a']]);
      expect(prerequisiteCycles([{ id: 'a', prerequisites: ['b'] }, { id: 'b', prerequisites: [] }])).toEqual([]);
    });
    it('fails on unknown [[id]] and [[g:id]] cross-links (planned ids are fine)', () =>
      expect(fail('references', (t) => void (alpha(t).en += '\nSee [[ghost]] and [[g:nope|term]].\n'))).toEqual([
        expect.stringMatching(/en\.md: \[\[ghost\]\] → unknown entity/),
        expect.stringMatching(/en\.md: \[\[g:nope\]\] → unknown glossary entry/),
      ]));
    it('fails on an unknown lens term', () =>
      expect(fail('references', (t) => void (meta(alpha(t)).lenses.marker = ['nope']))).toEqual([expect.stringMatching(/unknown marker lens term "nope"/)]));
    it('fails on an unknown source', () =>
      expect(fail('references', (t) => meta(alpha(t)).sources.push({ source: 'nope' }))).toEqual([expect.stringMatching(/unknown source "nope"/)]));
    it('fails on an unknown classification source', () =>
      expect(fail('references', (t) => void (meta(alpha(t)).classification = { source: 'nope', checked: '2026-11-03' }))).toEqual([
        expect.stringMatching(/unknown classification source "nope"/),
      ]));
    it('fails on unknown images (entity, pattern, question)', () =>
      expect(
        fail('references', (t) => {
          meta(alpha(t)).images[0].id = 'nope';
          meta(t.patterns[0]!).images[0].id = 'nope';
          doc(t.questions[0]!).image = 'nope';
        }),
      ).toHaveLength(3));
    it('fails when a matrix row references an unknown entity', () =>
      expect(fail('references', (t) => void (meta(t.patterns[0]!).matrix.rows[0].entity = 'nope'))).toEqual([expect.stringMatching(/matrix row → unknown entity/)]));
    it('fails when matrix cells do not match the columns (schema)', () =>
      expect(fail('schema', (t) => meta(t.patterns[0]!).matrix.rows[0].cells.push({ it: 'x', en: 'x' }))).toEqual([expect.stringMatching(/columns.length - 1/)]));
  });

  describe('anatomy and sites', () => {
    const organs = (t: Tree) => t.anatomy.data as Any[];
    const sites = (t: Tree) => meta(alpha(t)).sites as Any[];
    it('accepts a site with a claim, a site without one, and a card with no sites', () => {
      expect(fail('references', (t) => sites(t).push({ organ: 'fx-organ' }))).toEqual([]);
      expect(fail('references', (t) => delete meta(alpha(t)).sites)).toEqual([]);
    });
    it('fails when a site names an organ that is not in anatomy.yaml', () =>
      expect(fail('references', (t) => sites(t).push({ organ: 'ghost' }))).toEqual([expect.stringMatching(/fx-alpha\/meta\.yaml: sites → unknown organ "ghost"/)]));
    it('fails when a site cites a claim that is not in the ledger of its own card (even one that exists in another ledger)', () =>
      expect(fail('references', (t) => sites(t).push({ organ: 'fx-organ', claim: 'fx-alpha-c404' }, { organ: 'fx-organ', claim: 'fx-pattern-c001' }))).toEqual([
        expect.stringMatching(/sites → claim "fx-alpha-c404" is not in docs\/ledger\/fx-alpha\.yaml/),
        expect.stringMatching(/sites → claim "fx-pattern-c001" is not in docs\/ledger\/fx-alpha\.yaml/),
      ]));
    it('fails when a draft card with no ledger cites a claim', () =>
      expect(fail('references', (t) => void (meta(addBeta(t)).sites = [{ organ: 'fx-organ', claim: 'fx-alpha-c001' }]))).toEqual([
        expect.stringMatching(/fx-beta\/meta\.yaml: sites → claim "fx-alpha-c001" is not in docs\/ledger\/fx-beta\.yaml/),
      ]));
    it('fails on a duplicate organ id', () =>
      expect(fail('references', (t) => organs(t).push({ ...organs(t)[0], order: 12 }))).toEqual([expect.stringMatching(/anatomy\.yaml: duplicate organ id "fx-organ"/)]));
    it('fails when an organ names a system term that does not exist', () =>
      expect(fail('references', (t) => void (organs(t)[0].system = 'nope'))).toContainEqual(expect.stringMatching(/organ "fx-organ": unknown system term "nope"/)));
    it('fails when an anatomical system has no organ, but not for general or systemic', () => {
      expect(fail('references', (t) => void (t.anatomy.data = []))).toContainEqual(expect.stringMatching(/anatomy\.yaml: system "fx-system" has no organ/));
      const system = (t: Tree) => doc(t.taxonomy.find((d) => d.path.endsWith('system.yaml'))!);
      expect(fail('references', (t) => system(t).terms.push({ id: 'general', label: { it: 'G', en: 'G' }, order: 2 }, { id: 'systemic', label: { it: 'S', en: 'S' }, order: 3 }))).toEqual([]);
      expect(fail('references', (t) => system(t).terms.push({ id: 'heart', label: { it: 'C', en: 'H' }, order: 4 }))).toEqual([expect.stringMatching(/system "heart" has no organ/)]);
    });
    it('fails when an organ sits under general or systemic (schema)', () =>
      expect(fail('schema', (t) => void (organs(t)[0].system = 'general'))).toEqual([expect.stringMatching(/anatomy\.yaml: 0\.system: an organ belongs to an anatomical system/)]));
    it('fails when anatomy.yaml is missing or has no label in one language (schema)', () => {
      expect(fail('schema', (t) => void (t.anatomy.data = null))).toHaveLength(1);
      expect(fail('schema', (t) => void delete organs(t)[0].label.it)).toEqual([expect.stringMatching(/anatomy\.yaml: 0\.label\.it/)]);
    });
  });

  describe('review status', () => {
    it('fails when the reviewer is not listed', () =>
      expect(fail('review', (t) => void (meta(alpha(t)).reviewedBy.name = 'Someone Else'))).toEqual([expect.stringMatching(/not listed in REVIEWERS/)]));
    it('fails when REVIEWERS is missing', () => expect(fail('review', (t) => void (t.reviewers = null))).toEqual([expect.stringMatching(/REVIEWERS file is missing/)]));
    it('fails on an expert-reviewed question without reviewedBy', () =>
      expect(fail('review', (t) => void (doc(t.questions[0]!).reviewStatus = 'expert-reviewed'))).toEqual([expect.stringMatching(/requires reviewedBy/)]));
  });

  describe('images', () => {
    it('fails on CC BY-SA without ownerApproved', () =>
      expect(fail('images', (t) => void (doc(t.images[0]!).license = 'CC-BY-SA-4.0'))).toEqual([expect.stringMatching(/ownerApproved/)]));
    it('fails on a patient-identifiable image', () =>
      expect(fail('images', (t) => void (doc(t.images[0]!).patientIdentifiable = true))).toEqual([expect.stringMatching(/patientIdentifiable/)]));
    it('fails when the image file is missing', () =>
      expect(fail('images', (t) => t.assets.clear())).toEqual([expect.stringMatching(/not found under src\/assets\/images/)]));
  });
});
