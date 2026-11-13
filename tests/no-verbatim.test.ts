// scripts/no-verbatim.mjs on a tiny handwritten reference: the counts, and the line numbers of --where (never reference text).
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const REFERENCE = 'alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu nu xi omicron pi rho sigma tau upsilon';

function run(card: string, ...flags: string[]) {
  const dir = mkdtempSync(join(tmpdir(), 'no-verbatim-'));
  mkdirSync(join(dir, 'work'));
  writeFileSync(join(dir, 'work', 'ref.txt'), REFERENCE);
  writeFileSync(join(dir, 'card.md'), card);
  const r = spawnSync(process.execPath, ['scripts/no-verbatim.mjs', ...flags, join(dir, 'card.md')], { cwd: ROOT, encoding: 'utf8', env: { ...process.env, NO_VERBATIM_WORK: join(dir, 'work') } });
  return { status: r.status, out: r.stdout };
}

describe('no-verbatim', () => {
  const copied = 'A fresh opening line with nothing in common.\nbeta gamma delta epsilon zeta eta theta iota kappa\nA closing line of our own words.\n';

  it('fails on a card that shares 8-grams with the reference, and prints counts only', () => {
    const { status, out } = run(copied);
    expect(status).toBe(1);
    expect(out).toMatch(/^FAIL .*card\.md: 8-gram overlap \d+\.\d{2}%, shared 12-word runs: 0$/m);
    expect(out).not.toContain('lines:');
    expect(out).not.toContain('epsilon');
  });

  it('--where adds the line numbers of the shared text, and still prints no reference word', () => {
    const { status, out } = run(copied, '--where');
    expect(status).toBe(1);
    expect(out).toMatch(/^ {2}lines: 2$/m);
    expect(out).not.toContain('epsilon');
  });

  it('passes a card in its own words, with or without --where', () => {
    const own = 'Hyaline means glassy under the microscope.\nIt names an appearance and not a substance.\n';
    expect(run(own).status).toBe(0);
    expect(run(own, '--where').status).toBe(0);
  });
});
