/**
 * Fast per-entity content validator (no Astro build). Selected by env ENTITY:
 *   npm run validate:entity -- <id>        (wrapper: scripts/validate-entity.mjs)
 *   ENTITY=<id> npx vitest run tests/content-one
 * Skipped when ENTITY is unset, so `npm test` is unaffected.
 * Ids in plan/*-plan.md tables count as relation targets; set STRICT_TARGETS=1 (finalize) to require written entities.
 * Checks CONTENT_SCHEMA §1, §2 and §8 for one entity folder plus its claim ledger.
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { parse } from 'yaml';
import { z } from 'astro/zod';
import { entitySchema, entityBodySchema, Id, LENSES, moduleSchema, sourceSchema, taxonomySchema } from '../../src/lib/schema.ts';
import { SECTIONS } from '../../src/i18n/sections.ts';

const ENTITY = process.env.ENTITY?.trim() ?? '';
const root = new URL('../../', import.meta.url);
const path = (p: string) => new URL(p, root);
const readText = (p: string) => readFileSync(path(p), 'utf8');
const readYaml = (p: string): unknown => parse(readText(p));

// ── Claim ledger (CONTENT_SCHEMA §8) ─────────────────────────────────────────
const SECOND_SOURCE_NEEDED = ['not-found-in-reference', 'beyond-reference', 'sources-differ'];
const ledgerSchema = z.object({
  entity: Id,
  claims: z.array(
    z
      .object({
        claimId: z.string().regex(/^[a-z0-9-]+-c\d{3}$/),
        section: z.enum(SECTIONS.map((s) => s.id) as [string, ...string[]]),
        statement: z.string().min(1),
        sourceRef: z.object({ source: Id, chapter: z.string().optional(), pages: z.string().optional() }),
        status: z.enum(['verified', 'contradicted', 'not-found-in-reference', 'beyond-reference', 'sources-differ']),
        secondSource: z.object({ source: Id, locator: z.string().min(1) }).optional(),
        verifiedBy: z.enum(['agent', 'human']),
        verifier: z.string().min(1),
        date: z.coerce.date(),
      })
      .refine((c) => !SECOND_SOURCE_NEEDED.includes(c.status) || c.secondSource, {
        message: 'secondSource is required for this status',
        path: ['secondSource'],
      }),
  ),
});

// ── Markdown helpers ─────────────────────────────────────────────────────────
const MARKER = /<!--c:([^>]*?)-->/g;
const LINK = /\[\[([^\]]+)\]\]/g;
/** A standalone number (not part of a name such as caspase-3, BCL-2, HSP70, c001). */
const NUMBER = /(?<![\p{L}\d\-–_/])\d+(?:[.,]\d+)?(?![\p{L}\d\-–_])/u;

type Body = { lang: string; titles: string[]; markers: Map<string, string>; dupes: string[]; lines: { section: string; text: string }[] };

function readBody(file: string): Body {
  const raw = readText(file);
  const fm = /^---\n([\s\S]*?)\n---\n/.exec(raw);
  const lang = entityBodySchema.parse(parse(fm?.[1] ?? '')).lang;
  const text = raw.slice(fm?.[0].length ?? 0).replace(/<!--(?!c:)[\s\S]*?-->/g, ''); // drop non-claim comments
  const titles: string[] = [];
  const markers = new Map<string, string>();
  const dupes: string[] = [];
  const lines: Body['lines'] = [];
  let section = '';
  for (const line of text.split('\n')) {
    const h2 = /^##\s+(.+?)\s*$/.exec(line);
    if (h2) {
      titles.push(h2[1]!);
      section = SECTIONS.find((s) => s.title[lang] === h2[1])?.id ?? `?${h2[1]}`;
      continue;
    }
    if (!line.trim()) continue;
    lines.push({ section, text: line });
    for (const m of line.matchAll(MARKER)) {
      if (markers.has(m[1]!)) dupes.push(m[1]!);
      markers.set(m[1]!, section);
    }
  }
  return { lang, titles, markers, dupes, lines };
}

/** Lines where a number is not followed by a claim marker on the same line. */
function unmarkedNumbers(b: Body): string[] {
  return b.lines
    .filter(({ text }) => !/^\s*\|?[\s|:-]+\|?\s*$/.test(text)) // table separator rows
    .filter(({ text }) => {
      const parts = text.replace(LINK, ' ').split(MARKER);
      const tail = parts.length % 2 === 1 ? parts.at(-1)! : '';
      return NUMBER.test(tail);
    })
    .map(({ section, text }) => `[${b.lang}/${section}] ${text.trim().slice(0, 120)}`);
}

// ── Lookups ──────────────────────────────────────────────────────────────────
function entityDir(id: string): string | undefined {
  for (const d of [id, `_${id}`, id.replace(/^_/, '')])
    if (existsSync(path(`src/content/entities/${d}/meta.yaml`))) return `src/content/entities/${d}`;
  return undefined;
}

function knownTargets(): Set<string> {
  const ids = new Set<string>();
  for (const d of readdirSync(path('src/content/entities/'))) {
    if (!existsSync(path(`src/content/entities/${d}/meta.yaml`))) continue;
    const meta = readYaml(`src/content/entities/${d}/meta.yaml`) as { id?: unknown };
    ids.add(typeof meta.id === 'string' ? meta.id : d.replace(/^_/, ''));
  }
  for (const m of moduleSchema.array().parse(readYaml('src/content/modules.yaml'))) for (const p of m.planned) ids.add(p.id);
  // shortcut: sibling entities listed in a module plan table (`| n | \`id\` |`) count as existing while agents write
  // them concurrently. Upgrade: run with STRICT_TARGETS=1 at finalize so only written entities/planned ids count.
  if (!process.env.STRICT_TARGETS && existsSync(path('plan/')))
    for (const f of readdirSync(path('plan/')).filter((f) => f.endsWith('-plan.md')))
      for (const m of readText(`plan/${f}`).matchAll(/^\|\s*\d+\s*\|\s*`([a-z0-9-]+)`/gm)) ids.add(m[1]!);
  return ids;
}

function taxonomyTerms(): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  for (const f of readdirSync(path('src/content/taxonomy/'))) {
    const t = taxonomySchema.parse(readYaml(`src/content/taxonomy/${f}`));
    out.set(t.lens, new Set(t.terms.map((x) => x.id)));
  }
  return out;
}

// ── The checks ───────────────────────────────────────────────────────────────
describe.skipIf(!ENTITY)(`entity ${ENTITY}`, () => {
  const dir = entityDir(ENTITY);
  const id = ENTITY.replace(/^_/, '');
  const metaRaw = dir ? readYaml(`${dir}/meta.yaml`) : undefined;
  const meta = entitySchema.safeParse(metaRaw);
  const bodies = (['en', 'it'] as const).map((l) => (dir && existsSync(path(`${dir}/${l}.md`)) ? readBody(`${dir}/${l}.md`) : undefined));
  const [en, itBody] = bodies;
  const ledgerFile = `docs/ledger/${id}.yaml`;

  it('folder and meta.yaml exist', () => {
    expect(dir, `no src/content/entities/${ENTITY}/meta.yaml`).toBeDefined();
  });

  it('meta.yaml matches the entity schema and its id matches the folder', () => {
    expect(meta.success ? [] : meta.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`)).toEqual([]);
    if (meta.success) expect(meta.data.id).toBe(id);
  });

  it('en.md and it.md exist with the right lang and exactly the 13 canonical sections in order', () => {
    for (const [i, lang] of (['en', 'it'] as const).entries()) {
      const b = bodies[i];
      expect(b, `${lang}.md missing`).toBeDefined();
      if (!b) continue;
      expect(b.lang, `${lang}.md frontmatter lang`).toBe(lang);
      expect(b.titles, `${lang}.md H2 titles`).toEqual(SECTIONS.map((s) => s.title[lang]));
    }
  });

  it('claim markers are well-formed, unique and identical in both languages (same section)', () => {
    if (!en || !itBody) return;
    const bad = [...en.markers.keys(), ...itBody.markers.keys()].filter((m) => !new RegExp(`^${id}-c\\d{3}$`).test(m));
    expect(bad, `markers must be <!--c:${id}-c###-->`).toEqual([]);
    expect([...en.dupes, ...itBody.dupes], 'duplicate markers').toEqual([]);
    expect([...itBody.markers.keys()].sort(), 'it.md markers vs en.md').toEqual([...en.markers.keys()].sort());
    const moved = [...en.markers].filter(([m, s]) => itBody.markers.has(m) && itBody.markers.get(m) !== s);
    expect(moved.map(([m]) => m), 'markers in a different section in it.md').toEqual([]);
  });

  it('every number is followed by a claim marker on the same line', () => {
    expect([...(en ? unmarkedNumbers(en) : []), ...(itBody ? unmarkedNumbers(itBody) : [])]).toEqual([]);
  });

  it('claim ledger matches the markers one-to-one, with valid rows', () => {
    expect(existsSync(path(ledgerFile)), `${ledgerFile} missing`).toBe(true);
    if (!existsSync(path(ledgerFile)) || !en) return;
    const parsed = ledgerSchema.safeParse(readYaml(ledgerFile));
    expect(parsed.success ? [] : parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`)).toEqual([]);
    if (!parsed.success) return;
    const rows = parsed.data.claims;
    expect(parsed.data.entity).toBe(id);
    const rowIds = rows.map((r) => r.claimId);
    expect(rowIds.filter((r, i) => rowIds.indexOf(r) !== i), 'duplicate ledger rows').toEqual([]);
    expect(rowIds.filter((r) => !en.markers.has(r)), 'ledger rows without a marker').toEqual([]);
    expect([...en.markers.keys()].filter((m) => !rowIds.includes(m)), 'markers without a ledger row').toEqual([]);
    const wrong = rows.filter((r) => en.markers.has(r.claimId) && en.markers.get(r.claimId) !== r.section);
    expect(wrong.map((r) => `${r.claimId}: ledger ${r.section}, text ${en.markers.get(r.claimId)}`)).toEqual([]);
    expect(rows.filter((r) => r.status === 'contradicted').map((r) => r.claimId), 'contradicted claims').toEqual([]);
    const sources = new Set(sourceSchema.array().parse(readYaml('src/content/sources.yaml')).map((s) => s.id));
    const unknown = rows.flatMap((r) => [r.sourceRef.source, r.secondSource?.source ?? r.sourceRef.source]).filter((s) => !sources.has(s));
    expect(unknown, 'ledger sources missing from sources.yaml').toEqual([]);
  });

  it('meta sources exist in sources.yaml', () => {
    if (!meta.success) return;
    const sources = new Set(sourceSchema.array().parse(readYaml('src/content/sources.yaml')).map((s) => s.id));
    expect(meta.data.sources.map((s) => s.source).filter((s) => !sources.has(s))).toEqual([]);
  });

  it('lens term ids exist in the taxonomy (>= 3 non-empty lenses is in the schema)', () => {
    if (!meta.success) return;
    const tax = taxonomyTerms();
    const missing = LENSES.flatMap((l) => meta.data.lenses[l].filter((t) => !tax.get(l)?.has(t)).map((t) => `${l}/${t}`));
    expect(missing).toEqual([]);
  });

  it('relation targets, prerequisites and [[links]] exist (entity or modules.yaml planned id)', () => {
    const known = knownTargets();
    const targets = meta.success ? [...meta.data.relations.map((r) => r.target), ...meta.data.prerequisites] : [];
    const links = bodies.flatMap((b) => b?.lines.flatMap(({ text }) => [...text.matchAll(LINK)].map((m) => m[1]!.trim())) ?? []);
    expect([...new Set([...targets, ...links])].filter((t) => !known.has(t))).toEqual([]);
  });

  it('differential is a table and high-yield is a bullet list with bold terms', () => {
    for (const b of bodies) {
      if (!b) continue;
      const of = (s: string) => b.lines.filter((l) => l.section === s).map((l) => l.text);
      expect(of('differential').some((t) => /^\s*\|.*\|/.test(t)), `${b.lang}: differential needs a markdown table`).toBe(true);
      const hy = of('high-yield');
      expect(hy.length > 0 && hy.every((t) => /^\s*[-*]\s/.test(t)), `${b.lang}: high-yield must be only bullets`).toBe(true);
      expect(hy.some((t) => /\*\*[^*]+\*\*/.test(t)), `${b.lang}: high-yield needs **bold** terms`).toBe(true);
    }
  });
});
