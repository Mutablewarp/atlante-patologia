// Batch metrics row (scripts/agent/metrics.mjs): the row, the table edit and the command, on temporary PROGRESS-like files.
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { appendRow, formatRow, parseArgs } from '../scripts/agent/metrics.mjs';

const ARGS = ['--batch', 'W02', '--cards', '8', '--tokens', '3200000', '--audit-total', '40', '--audit-wrong', '1', '--kb-per-card', '380', '--ci', 'first-try'];
const METRICS = { batch: 'W02', cards: 8, tokens: 3200000, auditTotal: 40, auditWrong: 1, kbPerCard: 380, ci: 'first-try' };
const ROW = '| W02 | 2026-11-12 | 8 | 400 k | 2.5 % (1/40) | 380 | first-try |';
const HEADER = '| Batch | Date | Cards | Tokens per card | Audit error rate | kB per card | CI |\n|---|---|---:|---:|---:|---:|---|';
const PROGRESS = '# Progress\n\n## Phase A\n\nText.\n\n| a | b |\n|---|---|\n| 1 | 2 |\n';

describe('formatRow', () => {
  it('writes batch, date, cards, tokens per card, audit error rate, kB per card and CI', () => {
    expect(formatRow(METRICS, '2026-11-12')).toBe(ROW);
  });

  it('shows n/a when nothing was audited, and rounds tokens per card to thousands', () => {
    expect(formatRow({ ...METRICS, auditTotal: 0, auditWrong: 0, tokens: 1234567, cards: 3 }, '2026-11-12')).toBe(
      '| W02 | 2026-11-12 | 3 | 412 k | n/a | 380 | first-try |',
    );
  });
});

describe('appendRow', () => {
  it('creates the heading and the table header at the end when they are missing', () => {
    expect(appendRow(PROGRESS, ROW)).toBe(`${PROGRESS}\n## V3 batch metrics\n\n${HEADER}\n${ROW}\n`);
  });

  it('adds one row under an existing table, without a second header', () => {
    const once = appendRow(PROGRESS, ROW);
    const twice = appendRow(once, ROW.replace('W02', 'W03'));
    expect(twice).toBe(`${once}${ROW.replace('W02', 'W03')}\n`);
    expect(twice.match(/## V3 batch metrics/g)).toHaveLength(1);
    expect(twice.match(/\| Batch \|/g)).toHaveLength(1);
  });

  it('replaces the row of a repeated batch: same row count, newer numbers', () => {
    const once = appendRow(PROGRESS, ROW);
    const newer = '| W02 | 2026-11-13 | 9 | 300 k | 0.0 % (0/40) | 400 | green |';
    const twice = appendRow(appendRow(once, ROW.replace('W02', 'W03')), newer);
    expect(twice).toBe(`${PROGRESS}\n## V3 batch metrics\n\n${HEADER}\n${newer}\n${ROW.replace('W02', 'W03')}\n`);
    expect(twice.match(/\| W02 \|/g)).toHaveLength(1);
  });

  it('keeps the row inside its table when another section follows', () => {
    const text = `${PROGRESS}\n## V3 batch metrics\n\n${HEADER}\n${ROW}\n\n## Later\n\nMore text.\n`;
    const next = ROW.replace('W02', 'W03');
    expect(appendRow(text, next)).toBe(`${PROGRESS}\n## V3 batch metrics\n\n${HEADER}\n${ROW}\n${next}\n\n## Later\n\nMore text.\n`);
  });

  it('adds the table header under a heading that has none', () => {
    const text = `${PROGRESS}\n## V3 batch metrics\n\nNo rows yet.\n\n## Later\n\nMore text.\n`;
    expect(appendRow(text, ROW)).toBe(`${PROGRESS}\n## V3 batch metrics\n\nNo rows yet.\n\n${HEADER}\n${ROW}\n\n## Later\n\nMore text.\n`);
  });
});

describe('parseArgs', () => {
  it('reads the options as numbers and text', () => {
    expect(parseArgs(ARGS)).toEqual(METRICS);
  });

  it('refuses a missing value, a negative number, zero cards and more wrong than audited', () => {
    const without = (flag: string) => {
      const at = ARGS.indexOf(flag);
      return [...ARGS.slice(0, at), ...ARGS.slice(at + 2)];
    };
    for (const flag of ['--batch', '--cards', '--tokens', '--audit-total', '--audit-wrong', '--kb-per-card', '--ci']) {
      expect(() => parseArgs(without(flag)), flag).toThrow(flag);
    }
    expect(() => parseArgs(ARGS.map((a) => (a === '3200000' ? 'lots' : a)))).toThrow('--tokens');
    expect(() => parseArgs(ARGS.map((a) => (a === '8' ? '0' : a)))).toThrow('--cards');
    expect(() => parseArgs(ARGS.map((a) => (a === '1' ? '-1' : a)))).toThrow('--audit-wrong');
    expect(() => parseArgs(ARGS.map((a) => (a === '1' ? '41' : a)))).toThrow('--audit-wrong');
  });

  it('refuses an empty value and a value that is the next flag', () => {
    expect(() => parseArgs(ARGS.map((a) => (a === 'W02' ? '--cards' : a)))).toThrow('--batch needs a value');
    expect(() => parseArgs(ARGS.map((a) => (a === '8' ? '' : a)))).toThrow('--cards needs a value');
    expect(() => parseArgs(ARGS.map((a) => (a === '3200000' ? '' : a)))).toThrow('--tokens needs a value');
  });

  it('keeps a pipe or a line break out of a table cell', () => {
    expect(parseArgs(ARGS.map((a) => (a === 'first-try' ? 'first | try\nlate' : a))).ci).toBe('first try late');
  });
});

describe('the command', () => {
  const dir = mkdtempSync(join(tmpdir(), 'metrics-'));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));
  const script = fileURLToPath(new URL('../scripts/agent/metrics.mjs', import.meta.url));
  const real = fileURLToPath(new URL('../docs/PROGRESS.md', import.meta.url));

  it('appends the heading, the header and a row to a copy of docs/PROGRESS.md, then only a row', () => {
    const copy = join(dir, 'PROGRESS.md');
    copyFileSync(real, copy);
    const original = readFileSync(copy, 'utf8');
    const printed = execFileSync(process.execPath, [script, ...ARGS, '--file', copy], { encoding: 'utf8' }).trim();
    expect(printed).toMatch(/^\| W02 \| \d{4}-\d{2}-\d{2} \| 8 \| 400 k \| 2\.5 % \(1\/40\) \| 380 \| first-try \|$/);
    const first = readFileSync(copy, 'utf8');
    expect(first.startsWith(original.trimEnd())).toBe(true);
    expect(first.endsWith(`## V3 batch metrics\n\n${HEADER}\n${printed}\n`)).toBe(true);

    const again = execFileSync(process.execPath, [script, ...ARGS.map((a) => (a === 'W02' ? 'W03' : a)), '--file', copy], { encoding: 'utf8' }).trim();
    expect(readFileSync(copy, 'utf8')).toBe(`${first}${again}\n`);
  });

  it('exits 2 with one message when --file has no value or the file is missing', () => {
    for (const extra of [['--file'], ['--file', join(dir, 'ghost.md')]]) {
      let result = { status: 0, stderr: '' };
      try {
        execFileSync(process.execPath, [script, ...ARGS, ...extra], { encoding: 'utf8', stdio: 'pipe' });
      } catch (e) {
        result = e as typeof result;
      }
      expect(result.status).toBe(2);
      expect(result.stderr.trim().split('\n')).toHaveLength(1);
    }
  });

  it('exits 2 and writes nothing when an option is wrong', () => {
    const copy = join(dir, 'untouched.md');
    writeFileSync(copy, PROGRESS);
    let status = 0;
    try {
      execFileSync(process.execPath, [script, '--batch', 'W02', '--file', copy], { encoding: 'utf8', stdio: 'pipe' });
    } catch (e) {
      status = (e as { status: number }).status;
    }
    expect(status).toBe(2);
    expect(readFileSync(copy, 'utf8')).toBe(PROGRESS);
  });
});
