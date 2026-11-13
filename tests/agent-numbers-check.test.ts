// Numbers check (scripts/agent/numbers-check.mjs): inline ledger YAML and source text, no reference files.
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { checkNumbers, citedPages, numbersIn, render, run, sourcePages } from '../scripts/agent/numbers-check.mjs';

const claim = (n: number, statement: string, pages: string) => `  - claimId: demo-c0${n}
    section: definition
    statement: "${statement}"
    sourceRef: { source: rubin-8e, chapter: "1", pages: "${pages}" }
    status: verified
    verifiedBy: agent
    verifier: "verifier-agent"
    date: 2026-11-03
`;

const LEDGER = `entity: demo
claims:
${claim(1, 'More than 90% of adults carry it, and 1-2 cm nodules form.', '41, 45-46')}${claim(2, 'It takes 3 to 6 weeks, at 0.5 cases per 1,000 people.', '47')}${claim(
  3,
  'No numerals in this statement.',
  '41',
)}${claim(4, 'A 99% figure from a page outside the packet.', '900')}${claim(5, 'It affects 48 patients.', '47')}`;

const SOURCE = `[p. 40]
Page 40 says 90 percent and 3 to 6 weeks.
[p. 41]
In 92 percent of adults a 1 cm to 2 cm nodule forms.
[p. 45]
The count is 1,000 per liter.
[p. 46]
Page 46 has Fig. 12 and nothing else.
[p. 47]
It takes 3 to 6 weeks (0.50 cases per 1000 people).
[truncated: printed pages 48-60 not included]
`;

describe('numbersIn', () => {
  it('finds integers, decimals, thousands, percentages and both ends of a range, once each', () => {
    expect(numbersIn('90% of 1,000 cells, 0.5 mm, 3-10 cm, 3 to 10 weeks, CD4+ and p53')).toEqual(['90', '1,000', '0.5', '3', '10', '4', '53']);
    expect(numbersIn('Ends with a full stop in 2020.')).toEqual(['2020']);
    expect(numbersIn('no digits here')).toEqual([]);
    expect(numbersIn(undefined)).toEqual([]);
  });
});

describe('citedPages', () => {
  it('reads lists and ranges, with hyphen or dash', () => {
    expect(citedPages('41, 45-46')).toEqual([41, 45, 46]);
    expect(citedPages('56–57')).toEqual([56, 57]);
    expect(citedPages('39')).toEqual([39]);
  });

  it('ignores words and what is in parentheses', () => {
    expect(citedPages('87 (ch. 2), 507 (ch. 11)')).toEqual([87, 507]);
    expect(citedPages('scattered')).toEqual([]);
    expect(citedPages(undefined)).toEqual([]);
  });
});

describe('sourcePages', () => {
  it('splits source.txt at the [p. N] markers and drops the truncation note', () => {
    const pages = sourcePages(SOURCE);
    expect([...pages.keys()]).toEqual([40, 41, 45, 46, 47]);
    expect(pages.get(41)).toContain('92 percent');
    expect(pages.get(47)).not.toContain('48');
  });
});

describe('checkNumbers', () => {
  const result = checkNumbers(LEDGER, SOURCE);

  it('flags a number that is not on the cited pages, even when it is on another page', () => {
    expect(result.notFound).toContainEqual({ claim: 'demo-c01', number: '90' });
    expect(result.notFound).toContainEqual({ claim: 'demo-c05', number: '48' });
  });

  it('accepts ranges, decimals and thousands written another way', () => {
    expect(result.notFound.map((n: { claim: string }) => n.claim)).not.toContain('demo-c02');
  });

  it('counts the numbers compared, skips a claim whose pages are not in the packet, and reads statements only', () => {
    expect(result.notFound).toHaveLength(2);
    expect(result.checked).toBe(3 + 4 + 1);
    expect(result.skippedClaims).toBe(1);
  });

  it('skips claims that are not objects', () => {
    expect(checkNumbers('claims:\n  - just text\n  - null\n  - 7\n', SOURCE)).toEqual({ checked: 0, skippedClaims: 0, notFound: [] });
  });

  it('copes with a ledger without claims', () => {
    expect(checkNumbers('entity: demo\n', SOURCE)).toEqual({ checked: 0, skippedClaims: 0, notFound: [] });
  });
});

describe('render', () => {
  it('stays within 30 lines and stays valid JSON, with a count of what it left out', () => {
    const notFound = Array.from({ length: 100 }, (_, i) => ({ claim: `demo-c${i}`, number: String(i) }));
    const text = render({ id: 'demo', checked: 150, skippedClaims: 2, notFound });
    expect(text.split('\n').length).toBeLessThanOrEqual(30);
    const out = JSON.parse(text);
    expect(out).toMatchObject({ id: 'demo', checked: 150, skippedClaims: 2, more: 80 });
    expect(out.notFound).toHaveLength(20);
  });

  it('shows an empty list as one short object', () => {
    expect(JSON.parse(render({ id: 'demo', checked: 3, skippedClaims: 0, notFound: [] }))).toEqual({ id: 'demo', checked: 3, skippedClaims: 0, notFound: [] });
  });
});

describe('run', () => {
  const root = mkdtempSync(join(tmpdir(), 'numbers-check-'));
  afterAll(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, 'docs/ledger'), { recursive: true });
  mkdirSync(join(root, '.work/packets/demo'), { recursive: true });
  writeFileSync(join(root, 'docs/ledger/demo.yaml'), LEDGER);
  writeFileSync(join(root, '.work/packets/demo/source.txt'), SOURCE);
  writeFileSync(join(root, 'docs/ledger/broken.yaml'), 'claims: [unclosed');
  mkdirSync(join(root, '.work/packets/broken'), { recursive: true });
  writeFileSync(join(root, '.work/packets/broken/source.txt'), SOURCE);

  it('reads the ledger and the packet of a card', () => {
    expect(run('demo', root)).toMatchObject({ id: 'demo', checked: 8, skippedClaims: 1 });
  });

  it('answers with a note, not an error, when a file is missing, the YAML is broken or the id is bad', () => {
    expect(run('ghost', root)).toEqual({ id: 'ghost', checked: 0, skippedClaims: 0, notFound: [], note: 'docs/ledger/ghost.yaml not found' });
    expect(run('broken', root).note).toMatch(/^ledger YAML is not valid(, line \d+)?$/);
    expect(run('../demo', root).note).toMatch(/usage/);
  });
});

describe('the command', () => {
  it('prints JSON and exits 0 even when the card has no packet', () => {
    const script = fileURLToPath(new URL('../scripts/agent/numbers-check.mjs', import.meta.url));
    const out = JSON.parse(execFileSync(process.execPath, [script, 'no-such-card'], { encoding: 'utf8' }));
    expect(out).toMatchObject({ id: 'no-such-card', checked: 0, notFound: [] });
    expect(out.note).toBeTruthy();
  });
});
