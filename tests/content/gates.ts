/**
 * Content gates (docs/CONTENT_GATES.md). Pure functions over a loaded Tree:
 * every gate returns problems (fail the suite); parity also returns warnings
 * (stale translations, written to reports/translation-stale.json).
 */
import { createHash } from 'node:crypto';
import type { z } from 'astro/zod';
import {
  entityBodySchema,
  entitySchema,
  glossarySchema,
  imageSchema,
  ledgerSchema,
  moduleSchema,
  NEEDS_SECOND_SOURCE,
  patternSchema,
  questionSchema,
  sourceSchema,
  taxonomySchema,
  LENSES,
  type Entity,
  type Ledger,
} from '../../src/lib/schema.ts';
import { SECTIONS, QUICK_CHECK } from '../../src/i18n/sections.ts';
import { contradictoryPairs } from '../../src/lib/relations.ts';
import { claimMarkers, crossLinks, h2Titles, sectionTexts, splitFrontmatter, unmarkedNumericSentences } from './markdown.ts';
import { isFixtureDoc, type Doc, type Tree, type Unit } from './tree.ts';

export type Gate = 'schema' | 'parity' | 'ledger' | 'numbers' | 'references' | 'review' | 'images';
export type Problem = { gate: Gate; file: string; message: string };
export type StaleTranslation = { file: string; expected: string; actual: string | null };

type Pattern = z.infer<typeof patternSchema>;
type Question = z.infer<typeof questionSchema>;
type Image = z.infer<typeof imageSchema>;

export type Parsed = {
  problems: Problem[];
  entities: { unit: Unit; data: Entity }[];
  patterns: { unit: Unit; data: Pattern }[];
  questions: { doc: Doc; data: Question }[];
  images: { doc: Doc; data: Image }[];
  /** ids of non-fixture glossary entries */
  glossary: Set<string>;
  taxonomy: Map<string, Set<string>>;
  planned: Set<string>;
  sources: Set<string>;
  ledgers: Map<string, { doc: Doc; data: Ledger }>;
};

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
const issues = (e: z.ZodError) => e.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; ');

/** Schema-parse every document; failures are problems and the document is left out of later gates. */
export function parseTree(tree: Tree): Parsed {
  const problems: Problem[] = [];
  const take = <T>(schema: z.ZodType<T>, doc: Doc, gate: Gate): T | undefined => {
    const r = schema.safeParse(doc.data);
    if (r.success) return r.data;
    problems.push({ gate, file: doc.path, message: issues(r.error) });
    return undefined;
  };
  const units = <T extends { id: string }>(list: Unit[], schema: z.ZodType<T>) =>
    list.flatMap((unit) => {
      const data = take(schema, unit.meta, 'schema');
      if (data && data.id !== unit.id)
        problems.push({ gate: 'schema', file: unit.meta.path, message: `id "${data.id}" must equal the folder name "${unit.id}"` });
      return data ? [{ unit, data }] : [];
    });
  const docs = <T>(list: Doc[], schema: z.ZodType<T>, gate: Gate) =>
    list.flatMap((doc) => {
      const data = take(schema, doc, gate);
      return data ? [{ doc, data }] : [];
    });

  const taxonomy = new Map(docs(tree.taxonomy, taxonomySchema, 'schema').map(({ data }) => [data.lens as string, new Set(data.terms.map((t) => t.id))]));
  const modules = take(moduleSchema.array(), tree.modules, 'schema') ?? [];
  const sources = take(sourceSchema.array(), tree.sources, 'schema') ?? []; // existsVerified is required by the schema
  const ledgers = new Map<string, { doc: Doc; data: Ledger }>();
  for (const [id, doc] of tree.ledgers) {
    const data = take(ledgerSchema, doc, 'ledger');
    if (!data) continue;
    if (data.entity !== id) problems.push({ gate: 'ledger', file: doc.path, message: `entity "${data.entity}" must equal the file name "${id}"` });
    ledgers.set(id, { doc, data });
  }
  return {
    problems,
    entities: units(tree.entities, entitySchema),
    patterns: units(tree.patterns, patternSchema),
    questions: docs(tree.questions, questionSchema, 'schema'),
    images: docs(tree.images, imageSchema, 'images'),
    glossary: new Set(docs(tree.glossary, glossarySchema, 'schema').filter(({ doc }) => !isFixtureDoc(doc)).map(({ data }) => data.id)),
    taxonomy,
    planned: new Set(modules.flatMap((m) => m.planned.map((p) => p.id))),
    sources: new Set(sources.map((s) => s.id)),
    ledgers,
  };
}

/** Gate 1: both languages, canonical sections in order, identical claim markers, translation freshness. */
export function parityGate(tree: Tree): { problems: Problem[]; stale: StaleTranslation[] } {
  const problems: Problem[] = [];
  const stale: StaleTranslation[] = [];
  const check = (unit: Unit, canonical: boolean) => {
    const p = (file: string, message: string) => problems.push({ gate: 'parity', file: `${unit.dir}/${file}`, message });
    if (unit.en === undefined) p('en.md', 'missing');
    if (unit.it === undefined) p('it.md', 'missing');
    if (unit.en === undefined || unit.it === undefined) return;
    const docs = { en: splitFrontmatter(unit.en), it: splitFrontmatter(unit.it) };
    for (const lang of ['en', 'it'] as const) {
      const fm = entityBodySchema.safeParse(docs[lang].data);
      if (!fm.success) p(`${lang}.md`, `frontmatter: ${issues(fm.error)}`);
      else if (fm.data.lang !== lang) p(`${lang}.md`, `frontmatter lang is "${fm.data.lang}"`);
      if (canonical) {
        const want = SECTIONS.map((s) => s.title[lang]);
        const got = h2Titles(docs[lang].body);
        const i = Array.from({ length: Math.max(want.length, got.length) }, (_, k) => k).find((k) => got[k] !== want[k]);
        if (i !== undefined)
          p(`${lang}.md`, `H2 sections must be the 13 canonical titles in order; #${i + 1}: expected "${want[i] ?? '(none)'}", got "${got[i] ?? '(none)'}"`);        const text = sectionTexts(docs[lang].body);
        const title = (id: string) => SECTIONS.find((x) => x.id === id)!.title[lang];
        const lines = (id: string) => (text.get(title(id)) ?? '').replace(/<!--[\s\S]*?-->/g, '').split('\n').filter((l) => l.trim());
        if (!lines('differential').some((l) => /^\s*\|.*\|\s*$/.test(l))) p(`${lang}.md`, 'differential diagnosis needs a Markdown table');
        const hy = lines('high-yield');
        if (!hy.length || !hy.every((l) => /^\s*[-*]\s/.test(l))) p(`${lang}.md`, 'high-yield summary must be a bullet list only');
        else if (!hy.some((l) => /\*\*[^*]+\*\*/.test(l))) p(`${lang}.md`, 'high-yield summary needs **bold** key terms');
      }
    }
    if (!canonical && h2Titles(docs.en.body).length !== h2Titles(docs.it.body).length) p('it.md', 'H2 section count differs from en.md');
    const en = claimMarkers(docs.en.body);
    const it = claimMarkers(docs.it.body);
    const onlyEn = [...en].filter((c) => !it.has(c));
    const onlyIt = [...it].filter((c) => !en.has(c));
    if (onlyEn.length) p('it.md', `claim markers missing (present in en.md): ${onlyEn.join(', ')}`);
    if (onlyIt.length) p('en.md', `claim markers missing (present in it.md): ${onlyIt.join(', ')}`);
    const expected = sha256(unit.en);
    const actual = (docs.it.data as { translatedFrom?: string } | null)?.translatedFrom ?? null;
    if (actual !== expected) stale.push({ file: `${unit.dir}/it.md`, expected, actual });
  };
  for (const u of tree.entities) check(u, true);
  for (const u of tree.patterns) check(u, false);
  return { problems, stale };
}

/** Gate 2: claim ledger for every published entity/pattern; question claims resolve. */
export function ledgerGate(tree: Tree, parsed: Parsed): Problem[] {
  const problems: Problem[] = [];
  const allClaims = new Set([...parsed.ledgers.values()].flatMap((l) => l.data.claims.map((c) => c.claimId)));
  const published = [...parsed.entities, ...parsed.patterns].filter((x) => x.data.status === 'published');
  for (const { unit, data } of published) {
    const p = (file: string, message: string) => problems.push({ gate: 'ledger', file, message });
    const file = `docs/ledger/${unit.id}.yaml`;
    if (!tree.ledgers.has(unit.id)) {
      p(file, `missing ledger for published ${unit.dir}`);
      continue;
    }
    const ledger = parsed.ledgers.get(unit.id);
    if (!ledger) continue; // schema problem already reported
    const bodies = [unit.en ?? '', unit.it ?? ''];
    // Pattern matrix cells state facts too: each carries the same markers in both languages (CONTENT_SCHEMA §3).
    const cells = 'matrix' in data ? data.matrix.rows.flatMap((r) => r.cells) : [];
    for (const c of cells) {
      const [en, it] = [[...claimMarkers(c.en)].sort().join(), [...claimMarkers(c.it)].sort().join()];
      if (!en) p(unit.meta.path, `matrix cell without a claim marker: "${c.en.slice(0, 60)}"`);
      else if (en !== it) p(unit.meta.path, `matrix cell markers differ between en and it: "${c.en.slice(0, 60)}"`);
    }
    const markers = new Set([...bodies, ...cells.map((c) => c.en)].flatMap((b) => [...claimMarkers(b)]));
    const rows = new Set(ledger.data.claims.map((c) => c.claimId));
    for (const m of markers) if (!rows.has(m)) p(file, `no ledger row for marker ${m}`);
    for (const c of ledger.data.claims) {
      if (!markers.has(c.claimId)) p(file, `${c.claimId}: row has no marker in ${unit.dir}`);
      if (c.status === 'contradicted') p(file, `${c.claimId}: contradicted claims block publishing`);
      if (!parsed.sources.has(c.sourceRef.source)) p(file, `${c.claimId}: unknown source "${c.sourceRef.source}"`);
      if (NEEDS_SECOND_SOURCE.has(c.status) && c.secondSource && !parsed.sources.has(c.secondSource.source))
        p(file, `${c.claimId}: secondSource "${c.secondSource.source}" is not an existence-verified entry of sources.yaml`);
      if (c.status === 'sources-differ' && !bodies.every((b) => b.includes('class="sources-differ"')))
        p(file, `${c.claimId}: sources-differ needs <aside class="sources-differ"> in en.md and it.md`);
    }
    // The page shows only meta `sources`, so it must list every known source its ledger relies on.
    const cited = new Set(data.sources.map((s) => s.source));
    const relied = ledger.data.claims.flatMap((c) => [c.sourceRef.source, ...(c.secondSource ? [c.secondSource.source] : [])]);
    for (const id of new Set(relied)) if (parsed.sources.has(id) && !cited.has(id)) p(unit.meta.path, `sources must list "${id}", which the ledger cites`);
  }
  for (const { doc, data } of parsed.questions)
    if (data.status === 'published')
      for (const c of data.claims) if (!allClaims.has(c)) problems.push({ gate: 'ledger', file: doc.path, message: `claim "${c}" is not in any ledger` });
  return problems;
}

/** Gate 3: sentences stating numbers end with a claim marker. */
export function numbersGate(tree: Tree): Problem[] {
  return [...tree.entities, ...tree.patterns].flatMap((u) =>
    (['en', 'it'] as const).flatMap((lang) =>
      unmarkedNumericSentences(splitFrontmatter(u[lang] ?? '').body).map((s) => ({
        gate: 'numbers' as const,
        file: `${u.dir}/${lang}.md`,
        message: `numeric sentence without claim marker: "${s.slice(0, 100)}"`,
      })),
    ),
  );
}

/** Gate 4: cross-references (relations, prerequisites, lenses, sources, images, patterns, questions). */
export function referencesGate(parsed: Parsed): Problem[] {
  const problems: Problem[] = [];
  const entities = parsed.entities.filter((e) => !e.unit.fixture); // `_` fixtures use placeholder targets on purpose
  const entityIds = new Set(entities.map((e) => e.data.id));
  const known = new Set([...entityIds, ...parsed.planned]);
  const imageIds = new Set(parsed.images.map((i) => i.data.id));
  const sectionIds = new Set([...SECTIONS.map((s) => s.id), QUICK_CHECK.id]);
  const need = (ok: boolean, file: string, message: string) => ok || problems.push({ gate: 'references', file, message });

  for (const { unit, data: e } of entities) {
    const f = unit.meta.path;
    for (const r of e.relations) {
      need(r.target !== e.id, f, `self-relation (${r.type})`);
      need(known.has(r.target), f, `relation ${r.type} → unknown target "${r.target}" (not an entity nor planned in modules.yaml)`);
    }
    for (const t of e.prerequisites) need(known.has(t), f, `unknown prerequisite "${t}"`);
    for (const lens of LENSES)
      for (const t of e.lenses[lens]) need(parsed.taxonomy.get(lens)?.has(t) ?? false, f, `unknown ${lens} lens term "${t}"`);
    for (const s of e.sources) need(parsed.sources.has(s.source), f, `unknown source "${s.source}"`);
    if (e.classification) need(parsed.sources.has(e.classification.source), f, `unknown classification source "${e.classification.source}"`);
    for (const img of e.images) {
      need(imageIds.has(img.id), f, `unknown image "${img.id}"`);
      if (img.pairWith) need(imageIds.has(img.pairWith), f, `unknown pairWith image "${img.pairWith}"`);
    }
  }
  // [[id]] must name an entity or a planned id; [[g:id]] a (non-fixture) glossary entry (D038).
  for (const { unit } of [...entities, ...parsed.patterns.filter((x) => !x.unit.fixture)])
    for (const lang of ['en', 'it'] as const)
      for (const l of crossLinks(unit[lang] ?? ''))
        if (l.glossary) need(parsed.glossary.has(l.id), `${unit.dir}/${lang}.md`, `[[g:${l.id}]] → unknown glossary entry`);
        else need(known.has(l.id), `${unit.dir}/${lang}.md`, `[[${l.id}]] → unknown entity (not an entity nor planned in modules.yaml)`);
  for (const msg of contradictoryPairs(entities.map((e) => e.data)))
    problems.push({ gate: 'references', file: 'src/content/entities', message: `contradictory relations: ${msg}` });
  for (const cycle of prerequisiteCycles(entities.map((e) => e.data)))
    problems.push({ gate: 'references', file: 'src/content/entities', message: `prerequisite cycle: ${cycle.join(' → ')}` });

  for (const { unit, data: p } of parsed.patterns.filter((x) => !x.unit.fixture)) {
    const f = unit.meta.path;
    need(parsed.taxonomy.get('process')?.has(p.process) ?? false, f, `unknown process lens term "${p.process}"`);
    for (const s of p.sources) need(parsed.sources.has(s.source), f, `unknown source "${s.source}"`);
    for (const r of p.matrix.rows) need(entityIds.has(r.entity), f, `matrix row → unknown entity "${r.entity}"`);
    for (const img of p.images) {
      need(imageIds.has(img.id), f, `unknown image "${img.id}"`);
      need(entityIds.has(img.entity), f, `image ${img.id} → unknown entity "${img.entity}"`);
    }
  }
  for (const { doc, data: q } of parsed.questions.filter((x) => !isFixtureDoc(x.doc))) {
    for (const id of q.entities) need(entityIds.has(id), doc.path, `unknown entity "${id}"`);
    need(entityIds.has(q.backLink.entity), doc.path, `backLink → unknown entity "${q.backLink.entity}"`);
    need(sectionIds.has(q.backLink.section), doc.path, `backLink → unknown section "${q.backLink.section}"`);
    if (q.image) need(imageIds.has(q.image), doc.path, `unknown image "${q.image}"`);
  }
  return problems;
}

/** Each cycle in the prerequisites graph, once (DFS with an on-stack set). */
export function prerequisiteCycles(entities: readonly { id: string; prerequisites: string[] }[]): string[][] {
  const edges = new Map(entities.map((e) => [e.id, e.prerequisites]));
  const done = new Set<string>();
  const cycles: string[][] = [];
  const visit = (id: string, stack: string[]) => {
    const at = stack.indexOf(id);
    if (at >= 0) return void cycles.push([...stack.slice(at), id]);
    if (done.has(id)) return;
    for (const next of edges.get(id) ?? []) visit(next, [...stack, id]);
    done.add(id);
  };
  for (const id of edges.keys()) visit(id, []);
  return cycles;
}

/** Gate 5: expert-reviewed only with a reviewer listed in REVIEWERS. */
export function reviewGate(tree: Tree, parsed: Parsed): Problem[] {
  const problems: Problem[] = [];
  const items = [
    ...parsed.entities.map((x) => ({ file: x.unit.meta.path, data: x.data })),
    ...parsed.patterns.map((x) => ({ file: x.unit.meta.path, data: x.data })),
    ...parsed.questions.map((x) => ({ file: x.doc.path, data: x.data })),
  ];
  for (const { file, data } of items) {
    const p = (message: string) => problems.push({ gate: 'review', file, message });
    if (data.reviewStatus !== 'expert-reviewed') {
      if (data.reviewedBy) p('reviewedBy is only allowed when expert-reviewed');
      continue;
    }
    if (!data.reviewedBy) p('expert-reviewed requires reviewedBy');
    else if (tree.reviewers === null) p('expert-reviewed but the REVIEWERS file is missing');
    else if (!tree.reviewers.includes(data.reviewedBy.name)) p(`reviewer "${data.reviewedBy.name}" is not listed in REVIEWERS`);
  }
  return problems;
}

/** Gate 6: image files exist (licence and patientIdentifiable rules are schema-level, reported as gate "images"). */
export function imagesGate(tree: Tree, parsed: Parsed): Problem[] {
  return parsed.images.flatMap(({ doc, data }) =>
    [data.file, ...(data.fileIt ? [data.fileIt] : [])]
      .filter((f) => !tree.assets.has(f) && !(isFixtureDoc(doc) && tree.fixtureAssets.has(f)))
      .map((f) => ({ gate: 'images' as const, file: doc.path, message: `file "${f}" not found under src/assets/images` })),
  );
}

export function runGates(tree: Tree): { problems: Problem[]; stale: StaleTranslation[] } {
  const parsed = parseTree(tree);
  const parity = parityGate(tree);
  return {
    problems: [
      ...parsed.problems,
      ...parity.problems,
      ...ledgerGate(tree, parsed),
      ...numbersGate(tree),
      ...referencesGate(parsed),
      ...reviewGate(tree, parsed),
      ...imagesGate(tree, parsed),
    ],
    stale: parity.stale,
  };
}
