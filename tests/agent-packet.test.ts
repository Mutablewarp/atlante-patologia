// Card packet (scripts/agent/packet.mjs): page-range parsing, the printed-to-PDF page mapping, the 60 kB cap, depth by priority,
// and the packet files. Fixtures are handwritten and live in temporary directories; the reference text is private, so only the
// last block (read-only, skipped without the file) touches the real one.
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { SECTIONS } from '../src/i18n/sections.ts';
import { buildPacket, buildSource, depthFor, parsePages, SECTION_IDS, splitPages } from '../scripts/agent/packet.mjs';

const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const dirs: string[] = [];
afterAll(() => dirs.forEach((d) => rmSync(d, { recursive: true, force: true })));

/** A temporary repository root holding the given files. */
function fixture(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'agent-packet-'));
  dirs.push(root);
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  return root;
}

/** Reference text in which printed page N is PDF page N + 24. */
const reference = (printed: Record<number, string>) =>
  Object.entries(printed)
    .map(([n, text]) => `=== PAGE ${Number(n) + 24} ===\n${text}\n`)
    .join('\n');

describe('parsePages', () => {
  it.each([
    ['655–662', range(655, 662)],
    ['184, 235–239; 1099–1101 (pre-2019)', [184, ...range(235, 239), ...range(1099, 1101)]],
    ['Pap 1031–1033; FNA 759–760, 1162', [759, 760, 1031, 1032, 1033, 1162]],
    ['scattered: 1078, 1083', [1078, 1083]],
    ['59–75; 75–88', range(59, 88)],
    ['—', []],
    ['scattered', []],
    ['scattered (no methods section)', []],
    ['— (incidental only)', []],
  ])('reads %j', (text, pages) => {
    expect(parsePages(text)).toEqual(pages);
  });
});

describe('source text', () => {
  const texts = splitPages(reference({ 1: 'alpha', 2: 'beta\ngamma', 4: 'delta' }));

  it('maps printed page N to PDF page N + 24', () => {
    expect([...texts.keys()]).toEqual([25, 26, 28]);
    expect(texts.get(26)).toBe('beta\ngamma');
  });

  it('puts a [p. N] line before each page, in page order, and reports pages the text lacks', () => {
    const out = buildSource([1, 2, 3, 4], texts);
    expect(out.text).toBe('[p. 1]\nalpha\n\n[p. 2]\nbeta\ngamma\n\n[p. 4]\ndelta\n');
    expect(out.pages).toEqual([1, 2, 4]);
    expect(out.missing).toEqual([3]);
  });

  it('is empty when no page is asked for', () => {
    expect(buildSource([], texts).text).toBe('');
  });

  it('drops pages from the end and says which, within the cap', () => {
    const big = splitPages(reference(Object.fromEntries(range(1, 5).map((n) => [n, 'x'.repeat(40)]))));
    const out = buildSource(range(1, 5), big, 150);
    expect(out.pages).toEqual([1, 2]);
    expect(out.dropped).toEqual([3, 4, 5]);
    expect(out.text.endsWith('\n[truncated: printed pages 3-5 not included]\n')).toBe(true);
    expect(Buffer.byteLength(out.text)).toBeLessThanOrEqual(150);
  });

  it('caps at 60,000 bytes, counting bytes and not characters', () => {
    const big = splitPages(reference(Object.fromEntries(range(1, 10).map((n) => [n, 'é'.repeat(4000)]))));
    const out = buildSource(range(1, 10), big);
    expect(out.pages).toEqual(range(1, 7));
    expect(Buffer.byteLength(out.text)).toBeLessThanOrEqual(60_000);
    expect(out.text.split('\n').at(-2)).toBe('[truncated: printed pages 8-10 not included]');
  });

  it('keeps everything under the cap', () => {
    expect(buildSource([1, 2], texts, 60_000).dropped).toEqual([]);
  });
});

describe('depthFor', () => {
  const six = ['definition', 'micro', 'diagnosis', 'differential', 'high-yield', 'traps'];
  it.each([
    [{ priority: 'P0', tier: 'core' }, SECTION_IDS, 1200],
    [{ priority: 'P0', tier: 'extended' }, SECTION_IDS, 800],
    [{ priority: 'P1', tier: 'core' }, SECTION_IDS, 800],
    [{ priority: 'P1', tier: 'extended' }, SECTION_IDS, 800],
    [{ priority: 'P2', tier: 'extended' }, six, 500],
    [{ priority: 'P2', tier: 'core' }, six, 500],
  ])('%j', (row, sections, maxWordsEn) => {
    expect(depthFor(row)).toEqual({ sections, maxWordsEn });
  });

  it('uses the real section ids, in order', () => {
    expect(SECTION_IDS).toEqual(SECTIONS.map((s) => s.id));
    const ids = SECTION_IDS.filter((id) => depthFor({ priority: 'P2', tier: 'extended' }).sections.includes(id));
    expect(ids).toEqual(six);
  });
});

describe('buildPacket', () => {
  const row = (id: string, over: object) => ({
    id,
    names: { it: `${id} it`, en: `${id} en` },
    kind: 'disease',
    tier: 'core',
    pages: '1–2',
    priority: 'P0',
    editionDependent: false,
    module: 'g01',
    batch: 'W02',
    mustCover: ['first item', 'second item'],
    published: false,
    ...over,
  });
  const rows = [
    row('alpha', {}),
    row('beta', { priority: 'P2', tier: 'extended', pages: '—' }),
    row('gamma', { tier: 'extended', pages: '3', editionDependent: true }),
    row('delta', { priority: 'P1', pages: 'scattered: 2, 99 (see also 5000)' }),
  ];
  const BASE = {
    '.work/manifest.json': JSON.stringify(rows),
    '.work/fulltext.txt': reference({ 1: 'one', 2: 'two', 3: 'three' }),
    'src/content/taxonomy/system.yaml': 'lens: system\nterms:\n  - id: heart\n  - id: lung\n',
    'src/content/taxonomy/process.yaml': 'lens: process\nterms:\n  - id: necrosis\n',
    'src/content/modules.yaml': '- id: g01\n  planned:\n    - id: aa\n    - id: bb\n- id: g02\n',
    'src/content/entities/foo/meta.yaml': 'id: foo\n',
    'src/content/entities/_fixture-x/meta.yaml': 'id: x\n',
    'src/content/entities/draft/en.md': 'no meta yet\n',
  };
  const BRIEF =
    'Exemplar card, kind `process`:\n- `src/content/entities/foo/meta.yaml`\n- `docs/ledger/foo.yaml`\n- `src/content/images/foo-micro-1.yaml`\n' +
    'Placeholders are not exemplars: `src/content/entities/<id>/meta.yaml`, `docs/ledger/<id>.yaml`. Again `docs/ledger/foo.yaml`.\n';
  const root = fixture({ ...BASE, 'docs/agents/BRIEF.md': BRIEF });
  const read = (id: string, file: string, from = root) => readFileSync(join(from, '.work/packets', id, file), 'utf8');

  it('writes row.json with the depth, source.txt with [p. N] markers, and reports the size', () => {
    const out = buildPacket('alpha', { root });
    expect(out.pages).toBe(2);
    expect(out.bytes).toBe(Buffer.byteLength(read('alpha', 'source.txt')));
    expect(read('alpha', 'source.txt')).toBe('[p. 1]\none\n\n[p. 2]\ntwo\n');
    expect(JSON.parse(read('alpha', 'row.json'))).toMatchObject({ id: 'alpha', pages: '1–2', depth: { sections: SECTION_IDS, maxWordsEn: 1200 } });
  });

  it('lists the lens terms, the real entities (no fixtures, no folders without meta.yaml), the planned ids and the modules', () => {
    buildPacket('alpha', { root });
    expect(JSON.parse(read('alpha', 'vocab.json'))).toEqual({
      taxonomy: { process: ['necrosis'], system: ['heart', 'lung'] },
      entities: ['foo'],
      planned: ['aa', 'bb'],
      modules: ['g01', 'g02'],
    });
  });

  it('writes NOTES.md of at most 20 lines with names, depth, must-cover and the exemplar files of the brief', () => {
    buildPacket('alpha', { root });
    const notes = read('alpha', 'NOTES.md');
    expect(notes.trim().split('\n').length).toBeLessThanOrEqual(20);
    expect(notes).toContain('alpha en');
    expect(notes).toContain('all 13 sections');
    expect(notes).toContain('1200');
    expect(notes).toContain('first item; second item');
    expect(notes).toContain('exemplar files: src/content/entities/foo/meta.yaml, docs/ledger/foo.yaml, src/content/images/foo-micro-1.yaml\n');
    expect(notes).not.toContain('WARNING');
  });

  it('says so in NOTES.md when the brief names no exemplar', () => {
    const bare = fixture(BASE);
    buildPacket('alpha', { root: bare });
    expect(read('alpha', 'NOTES.md', bare)).toContain('exemplar files: none named in docs/agents/BRIEF.md');
  });

  it('leaves source.txt empty and says so when the reference has no section for the card', () => {
    expect(buildPacket('beta', { root })).toEqual({ pages: 0, bytes: 0 });
    expect(read('beta', 'source.txt')).toBe('');
    expect(read('beta', 'NOTES.md')).toContain('no section');
    expect(JSON.parse(read('beta', 'row.json')).depth).toEqual({ sections: ['definition', 'micro', 'diagnosis', 'differential', 'high-yield', 'traps'], maxWordsEn: 500 });
  });

  it('warns on an edition-dependent card and gives 800 words to P0 extended', () => {
    buildPacket('gamma', { root });
    expect(read('gamma', 'NOTES.md')).toContain('WARNING');
    expect(JSON.parse(read('gamma', 'row.json')).depth.maxWordsEn).toBe(800);
  });

  it('names the pages missing from the text and ignores numbers in parentheses', () => {
    expect(buildPacket('delta', { root }).pages).toBe(1);
    expect(read('delta', 'NOTES.md')).toContain('Not in the reference text: printed pages 99.');
  });

  it('adds the --extra pages, in page order', () => {
    buildPacket('gamma', { root, extra: '2' });
    expect(read('gamma', 'source.txt')).toBe('[p. 2]\ntwo\n\n[p. 3]\nthree\n');
  });

  it('fails with the reason for an id that is not in the manifest', () => {
    expect(() => buildPacket('nope', { root })).toThrow('"nope" is not in the manifest');
  });

  it('refuses a pattern row: comparison pages live in src/content/patterns and the pipeline has no flow for them yet', () => {
    const own = fixture({ ...BASE, '.work/manifest.json': JSON.stringify([row('epsilon', { kind: 'pattern' })]) });
    expect(() => buildPacket('epsilon', { root: own })).toThrow(/pattern row/);
  });

  it('fails when the manifest or the reference text is missing', () => {
    expect(() => buildPacket('alpha', { root: fixture({}) })).toThrow(/manifest.json not found/);
  });
});

const REAL = fileURLToPath(new URL('../.work/fulltext.txt', import.meta.url));
describe.skipIf(!existsSync(REAL))('the real reference text (owner machine only, read-only)', () => {
  // Read inside the tests: vitest still runs this callback to collect a skipped suite, and CI has no .work/.
  const load = () => splitPages(readFileSync(REAL, 'utf8'));

  it('prints the page number it is asked for: printed page N is PDF page N + 24', () => {
    const texts = load();
    for (const n of [38, 655, 662, 1200]) expect(texts.get(n + 24)?.split('\n').slice(0, 3).map((l: string) => l.trim())).toContain(String(n));
  });

  it('cuts a chapter within the cap with [p. N] markers', () => {
    const out = buildSource(parsePages('655–662'), load());
    expect(out.text.startsWith('[p. 655]\n')).toBe(true);
    expect(out.pages).toEqual(range(655, 662));
    expect(Buffer.byteLength(out.text)).toBeLessThanOrEqual(60_000);
  });
});
