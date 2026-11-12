// Card check (scripts/agent/card-check.mjs): each of the five gates with a failing and a passing case, --stage skipping, and the
// size of the output. The runners of the content tests and of no-verbatim are injected, so no test starts vitest, reads the
// private reference text or touches the real repository: every fixture lives in a temporary directory.
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { checkCard, countWords, format, parseContentOutput, parseVerbatimOutput, STAGES } from '../scripts/agent/card-check.mjs';

type Files = Record<string, string | null>;
type Options = NonNullable<Parameters<typeof checkCard>[1]>;
type Run = { status: number; output: string };

const dirs: string[] = [];
afterAll(() => dirs.forEach((d) => rmSync(d, { recursive: true, force: true })));

const sha = (s: string) => createHash('sha256').update(s).digest('hex');
const EN = `---\nlang: en\n---\n\n## Definition and epidemiology\n\nCoagulative necrosis keeps the outline of dead cells. <!--c:foo-c001-->\n\n## Pathogenesis\n\nIschemia stops ATP production. <!--c:foo-c002-->\n`;
const itText = (hash: string | null, ids = ['foo-c001', 'foo-c002']) =>
  `---\nlang: it\n${hash ? `translatedFrom: ${hash}\n` : ''}---\n\n## Definizione\n\n${ids.map((c) => `Testo. <!--c:${c}-->`).join('\n\n')}\n`;
const ledger = (ids = ['foo-c001', 'foo-c002']) => `entity: foo\nclaims:\n${ids.map((c) => `  - claimId: ${c}\n    section: definition\n`).join('')}`;

const BASE: Files = {
  'src/content/entities/foo/en.md': EN,
  'src/content/entities/foo/it.md': itText(sha(EN)),
  'docs/ledger/foo.yaml': ledger(),
  '.work/reference.txt': 'private text',
};
const ok = (): Run => ({ status: 0, output: '' });
const dirFoo = 'src/content/entities/foo';

/** Output of the content tests when "passes every gate" fails with these `[gate] file: message` lines (vitest's diff format). */
const listed = (...lines: string[]): Run => ({
  status: 1,
  output: [
    ' FAIL  |unit| tests/content-one/entity.test.ts > content gates for entity "foo" > passes every gate',
    `AssertionError: expected [ …(${lines.length}) ] to deeply equal []`,
    '',
    '- Expected',
    '+ Received',
    '',
    '- []',
    '+ [',
    ...lines.map((l) => `+   ${JSON.stringify(l)},`),
    '+ ]',
    '',
  ].join('\n'),
});

/** Runs the check on a temporary root holding BASE, changed by `files` (null removes a file). */
function check(files: Files = {}, options: Options = {}) {
  const root = mkdtempSync(join(tmpdir(), 'card-check-'));
  dirs.push(root);
  for (const [path, text] of Object.entries({ ...BASE, ...files })) {
    if (text === null) continue;
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  return checkCard('foo', { root, runContent: ok, runVerbatim: ok, ...options });
}
const gates = (r: { problems: { gate: string }[] }) => r.problems.map((p) => p.gate);

describe('a clean card', () => {
  it('passes every gate and counts the words of en.md without frontmatter or markers', () => {
    const r = check();
    expect(r).toMatchObject({ id: 'foo', ok: true, problems: [], more: 0, skipped: [], words: { en: 16, cap: null } });
    expect(r.words.it).toBeGreaterThan(0);
  });

  it('counts runs of letters and digits, one per hyphenated or apostrophe word, and skips comments and tags', () => {
    expect(countWords('---\nx: 1\n---\n# A non-specific cell\'s <b>10</b> mg <!--c:a-c001--> <!-- note -->')).toBe(5);
  });
});

describe('gate 1: the content tests', () => {
  it('turns each [gate] file: message line of the failing test into one problem', () => {
    const r = check({}, { runContent: () => listed('[parity] src/content/entities/foo/en.md: H2 sections must be the 13 canonical titles', '[ledger] docs/ledger/foo.yaml: unknown image "q" here') });
    expect(r.ok).toBe(false);
    expect(r.problems).toEqual([
      { gate: 'parity', where: `${dirFoo}/en.md`, message: 'H2 sections must be the 13 canonical titles' },
      { gate: 'ledger', where: 'docs/ledger/foo.yaml', message: 'unknown image "q" here' },
    ]);
  });

  it('gives any other failing test one problem with its first message line', () => {
    const output = ' FAIL  |unit| tests/content-one/entity.test.ts > content gates for entity "foo" > folder exists\nAssertionError: no src/content/entities/foo/: expected undefined to be defined\n ❯ tests/content-one/entity.test.ts:20:80\n';
    expect(parseContentOutput({ status: 1, output })).toEqual([
      { gate: 'content', where: 'tests/content-one', message: 'folder exists: no src/content/entities/foo/: expected undefined to be defined' },
    ]);
  });

  it('reports a run that produced no failing test, and passes on exit status 0', () => {
    expect(parseContentOutput({ status: 1, output: 'Error: Cannot find module vitest\n' })).toEqual([
      { gate: 'content', where: 'tests/content-one', message: 'vitest failed: Error: Cannot find module vitest' },
    ]);
    expect(parseContentOutput({ status: 0, output: 'Tests  2 passed (2)' })).toEqual([]);
  });

  it('cuts every message to 160 characters', () => {
    const [p] = parseContentOutput(listed(`[schema] ${dirFoo}/meta.yaml: ${'x'.repeat(400)}`));
    expect(p.message.length).toBeLessThanOrEqual(160);
  });

  it('passes the card id to the runner', () => {
    const seen: string[] = [];
    check({}, { runContent: (id: string) => (seen.push(id), ok()) });
    expect(seen).toEqual(['foo']);
  });
});

describe('gate 2: no-verbatim', () => {
  const images = { 'src/content/images/foo-micro-1.yaml': 'id: foo-micro-1\n', 'src/content/images/bar-micro-1.yaml': 'id: bar-micro-1\n', 'src/content/images/foo.txt': 'x' };

  it('reports each FAIL line of the script, which prints counts and never the reference text', () => {
    const output = `FAIL ${dirFoo}/en.md: 8-gram overlap 3.21%, shared 12-word runs: 1\nno-verbatim: 3 files checked against 1 reference text(s); 1 failed\n`;
    const r = check({}, { runVerbatim: () => ({ status: 1, output }) });
    expect(r.problems).toEqual([{ gate: 'verbatim', where: `${dirFoo}/en.md`, message: '8-gram overlap 3.21%, shared 12-word runs: 1' }]);
    expect(parseVerbatimOutput({ status: 1, output: 'boom\n' })[0].message).toBe('failed: boom');
    expect(parseVerbatimOutput({ status: 0, output })).toEqual([]);
  });

  it('passes on exit status 0', () => {
    expect(check({}, { runVerbatim: () => ({ status: 0, output: 'no-verbatim: 2 files checked against 1 reference text(s); 0 failed' }) }).ok).toBe(true);
  });

  it('checks the entity folder, the ledger and the card image yaml, and only those', () => {
    const seen: string[][] = [];
    const run = (paths: string[]) => (seen.push(paths), ok());
    check(images, { runVerbatim: run });
    expect(seen[0]).toEqual([dirFoo, 'docs/ledger/foo.yaml', 'src/content/images/foo-micro-1.yaml']);
  });

  it('is skipped, with a note, when .work/ holds no .txt reference', () => {
    const never = () => {
      throw new Error('no-verbatim must not run');
    };
    const r = check({ '.work/reference.txt': null, '.work/manifest.json': '[]' }, { runVerbatim: never });
    expect(r.ok).toBe(true);
    expect(r.skipped).toEqual(['verbatim (no .work/*.txt)']);
  });

  it('leaves the image yaml out before the scout stage', () => {
    const seen: string[][] = [];
    const run = (paths: string[]) => (seen.push(paths), ok());
    check(images, { stage: 'questions', runVerbatim: run });
    check(images, { stage: 'scout', runVerbatim: run });
    expect(seen.map((p) => p.length)).toEqual([2, 3]);
  });
});

describe('gate 3: translatedFrom', () => {
  it('fails when it.md carries another hash, no hash, or does not exist', () => {
    const wrong = check({ [`${dirFoo}/it.md`]: itText('0'.repeat(64)) });
    expect(wrong.problems).toEqual([{ gate: 'translation', where: `${dirFoo}/it.md`, message: `translatedFrom ${'0'.repeat(64)}; expected ${sha(EN)}` }]);
    expect(check({ [`${dirFoo}/it.md`]: itText(null) }).problems[0].message).toBe(`translatedFrom missing; expected ${sha(EN)}`);
    expect(check({ [`${dirFoo}/it.md`]: null }).problems).toEqual([{ gate: 'translation', where: `${dirFoo}/it.md`, message: 'it.md is missing' }]);
  });

  it('passes when translatedFrom is the sha256 of en.md, quoted or not', () => {
    expect(check().problems).toEqual([]);
    expect(check({ [`${dirFoo}/it.md`]: itText(`"${sha(EN)}"`) }).problems).toEqual([]);
  });
});

describe('gate 4: claim markers and the ledger', () => {
  it('fails when it.md lacks a marker of en.md, or has one en.md lacks', () => {
    expect(check({ [`${dirFoo}/it.md`]: itText(sha(EN), ['foo-c001']) }).problems).toEqual([{ gate: 'claims', where: `${dirFoo}/it.md`, message: 'markers only in en.md: c002' }]);
    expect(check({ [`${dirFoo}/it.md`]: itText(sha(EN), ['foo-c001', 'foo-c002', 'foo-c003']) }).problems).toEqual([{ gate: 'claims', where: `${dirFoo}/en.md`, message: 'markers only in it.md: c003' }]);
  });

  it('fails when the ledger has no row for a marker, or a row without a marker', () => {
    expect(check({ 'docs/ledger/foo.yaml': ledger(['foo-c001']) }).problems).toEqual([{ gate: 'claims', where: `${dirFoo}/en.md`, message: 'markers without a ledger row: c002' }]);
    expect(check({ 'docs/ledger/foo.yaml': ledger(['foo-c001', 'foo-c002', 'foo-c003']) }).problems).toEqual([{ gate: 'claims', where: 'docs/ledger/foo.yaml', message: 'ledger rows without a marker in en.md: c003' }]);
  });

  it('fails when the ledger is missing or unreadable', () => {
    expect(check({ 'docs/ledger/foo.yaml': null }).problems).toEqual([{ gate: 'claims', where: 'docs/ledger/foo.yaml', message: 'ledger is missing' }]);
    expect(check({ 'docs/ledger/foo.yaml': 'claims: [\n' }).problems).toEqual([{ gate: 'claims', where: 'docs/ledger/foo.yaml', message: 'cannot read the claims list' }]);
  });

  it('passes when en.md, it.md and the ledger list the same claims, in any order', () => {
    expect(check({ [`${dirFoo}/it.md`]: itText(sha(EN), ['foo-c002', 'foo-c001']), 'docs/ledger/foo.yaml': ledger(['foo-c002', 'foo-c001']) }).problems).toEqual([]);
  });
});

describe('gate 5: the word cap of the packet', () => {
  const packet = (maxWordsEn: number): Files => ({ '.work/packets/foo/row.json': JSON.stringify({ id: 'foo', depth: { sections: [], maxWordsEn } }) });

  it('fails above the cap and says both numbers', () => {
    const r = check(packet(15));
    expect(r.words).toMatchObject({ en: 16, cap: 15 });
    expect(r.problems).toEqual([{ gate: 'words', where: `${dirFoo}/en.md`, message: '16 words; the cap for this card is 15' }]);
  });

  it('passes at the cap, and when there is no packet', () => {
    expect(check(packet(16)).problems).toEqual([]);
    expect(check().words.cap).toBeNull();
  });
});

describe('--stage', () => {
  const noIt: Files = { [`${dirFoo}/it.md`]: null };
  const itMissing = () => listed(`[parity] ${dirFoo}/it.md: missing`, `[schema] ${dirFoo}/meta.yaml: bad`);

  it('skips the it.md gates at author, which comes before translator, but keeps en.md against the ledger', () => {
    const stage = 'author';
    const clean = check(noIt, { stage, runContent: itMissing });
    expect(gates(clean)).toEqual(['schema']); // the parity line about it.md is dropped, the others stay
    expect(clean.words.it).toBeNull();
    expect(clean.skipped).toContain('it.md gates (before translator)');
    expect(check({ ...noIt, 'docs/ledger/foo.yaml': ledger(['foo-c001']) }, { stage }).problems).toEqual([
      { gate: 'claims', where: `${dirFoo}/en.md`, message: 'markers without a ledger row: c002' },
    ]);
  });

  it.each(STAGES.slice(1))('applies the it.md gates at %s', (stage) => {
    expect(gates(check(noIt, { stage, runContent: itMissing }))).toEqual(['parity', 'schema', 'translation']);
  });

  it('applies every gate with --stage all or none, and the image files from scout on', () => {
    expect(gates(check(noIt, { stage: 'all', runContent: itMissing }))).toEqual(['parity', 'schema', 'translation']);
    expect(gates(check(noIt, { runContent: itMissing }))).toEqual(['parity', 'schema', 'translation']);
    expect(check({}, { stage: 'questions' }).skipped).toEqual(['image files (before scout)']);
    expect(check({}, { stage: 'scout' }).skipped).toEqual([]);
  });
});

describe('format', () => {
  it('prints valid JSON of at most 30 lines: 15 problems and the count of the rest', () => {
    const lines = Array.from({ length: 20 }, (_, i) => `[schema] ${dirFoo}/meta.yaml: problem ${i + 1}`);
    const r = check({}, { runContent: () => listed(...lines) });
    expect(r.problems).toHaveLength(15);
    expect(r.more).toBe(5);
    const text = format(r);
    expect(text.split('\n').length).toBeLessThanOrEqual(30);
    expect(JSON.parse(text)).toEqual(r);
  });

  it('is short and valid for a clean card', () => {
    const text = format(check());
    expect(JSON.parse(text)).toMatchObject({ id: 'foo', ok: true, problems: [], more: 0 });
    expect(text.split('\n').length).toBeLessThanOrEqual(10);
  });
});
