// scripts/agent/audit-batch.mjs with a fake `claude`: which cards get which check, the reports, the totals, the flags and the usage limit.
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { auditBatch, flags, line, PROMPTS, spread } from '../scripts/agent/audit-batch.mjs';

const put = (root: string, path: string, text: string) => {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), text);
};
function repo(ids: string[]) {
  const root = mkdtempSync(join(tmpdir(), 'audit-'));
  for (const id of ids) {
    put(root, `docs/ledger/${id}.yaml`, `entity: ${id}\nclaims:\n  - claimId: ${id}-c001\n  - claimId: ${id}-c002\n`);
    put(root, `.work/reports/${id}.author.json`, JSON.stringify({ id, stage: 'author', status: 'done', claims: 3 }));
  }
  return root;
}
type Exec = (cmd: string, args: string[], opts?: { cwd?: string; timeoutMs?: number; env?: NodeJS.ProcessEnv }) => Promise<{ status: number; stdout: string; stderr: string }>;
const result = (o: object, over: object = {}) => JSON.stringify({ type: 'result', subtype: 'success', is_error: false, num_turns: 5, total_cost_usd: 0.2, result: JSON.stringify(o), usage: {}, ...over });
const coverage = (id: string, over: object = {}) => ({ id, mustCover: [{ item: 'a', covered: true, claims: [`${id}-c001`], missing: '' }], danglingClaims: [], orphanQuestions: [], ...over });
const audit = (id: string, over: object = {}) => ({ id, audited: 15, errors: 0, half_errors: 0, close_paraphrases: 1, verdicts: [{ claim: `${id}-c001`, en_support: 'supported', it_faithful: 'yes', close_paraphrase: 'yes', medical_error: 'no', note: 'same order' }], ...over });
/** A fake agent that answers by the kind of prompt and the card id in it. */
const agents = (answer: (kind: 'audit' | 'coverage', id: string) => string, seen: string[] = []): Exec => async (_cmd, args) => {
  const prompt = args[1]!;
  const kind = prompt.startsWith('You are an independent auditor') ? 'audit' : 'coverage';
  const id = /Card id: ([a-z0-9-]+)\./.exec(prompt)![1]!;
  seen.push(`${kind}:${id}`);
  return { status: 0, stdout: answer(kind, id), stderr: '' };
};

describe('spread and the prompts', () => {
  it('takes n items evenly, the first included, and all when n is large', () => {
    expect(spread(['a', 'b', 'c', 'd', 'e', 'f'], 3)).toEqual(['a', 'c', 'e']);
    expect(spread(['a', 'b'], 4)).toEqual(['a', 'b']);
    expect(spread(['a', 'b'], 0)).toEqual([]);
  });

  it('names the card in every place of both prompts', () => {
    for (const p of Object.values(PROMPTS)) expect(p.replace(/\bID\b/g, 'x')).not.toMatch(/\bID\b/);
    expect(PROMPTS.audit).toContain('Audit exactly 15 claims');
    expect(PROMPTS.coverage).toContain('mustCover');
  });
});

describe('auditBatch', () => {
  it('checks coverage of every card, audits the spread ones, writes the reports and adds up', async () => {
    const ids = ['a', 'b', 'c', 'd'];
    const root = repo(ids);
    const seen: string[] = [];
    const r = await auditBatch({ root, ids, audit: 2, concurrency: 2, check: () => 'ok', exec: agents((kind, id) => result(kind === 'audit' ? audit(id) : coverage(id)), seen) });
    expect(seen.sort()).toEqual(['audit:a', 'audit:c', 'coverage:a', 'coverage:b', 'coverage:c', 'coverage:d']);
    expect(r.totals).toEqual({ cards: 4, audited: 30, errors: 0, halfErrors: 0, closeParaphrases: 2, flagged: [] });
    expect(r.costUsd).toBeCloseTo(1.2);
    expect(r.cards[0]).toMatchObject({ id: 'a', check: 'ok', claimsAuthor: 3, claimsNow: 2 });
    expect(r.cards[1]!.audit).toBeUndefined();
    expect(JSON.parse(readFileSync(join(root, '.work/reports/a.audit.json'), 'utf8')).audited).toBe(15);
    expect(readFileSync(join(root, '.work/usage.jsonl'), 'utf8').trim().split('\n')).toHaveLength(6);
    expect(line(r.cards[0]!)).toContain('a: check ok; claims 3 -> 2; must-cover missing 0, dangling 0, orphan questions 0; audit 15: errors 0, half 0, close 1');
  });

  it('flags a failing check, a missing must-cover item, a dangling claim, an audit error and a missing report', async () => {
    const ids = ['a', 'b', 'c'];
    const root = repo(ids);
    const answer = (kind: 'audit' | 'coverage', id: string) =>
      kind === 'audit'
        ? result(audit(id, { errors: 1 }))
        : id === 'b'
          ? 'not json'
          : result(coverage(id, id === 'c' ? { mustCover: [{ item: 'x', covered: false, claims: [], missing: 'no y' }], danglingClaims: ['c-c009'] } : {}));
    const r = await auditBatch({ root, ids, audit: 1, check: (_root: string, id: string) => (id === 'a' ? 'FAIL words' : 'ok'), exec: agents(answer) });
    expect(r.totals.flagged).toEqual(['a', 'b', 'c']);
    expect(flags(r.cards[0]!)).toEqual(['card:check fails', 'audit found an error']);
    expect(flags(r.cards[1]!)).toEqual(['no coverage report']);
    expect(flags(r.cards[2]!)).toEqual(['must-cover item missing', 'a question names a missing claim']);
    expect(line(r.cards[2]!)).toContain('must-cover missing 1 (x [no y]), dangling 1');
  });

  it('stops on a usage limit', async () => {
    const ids = ['a', 'b'];
    const root = repo(ids);
    const limit: Exec = async () => ({ status: 1, stdout: result({}, { is_error: true, result: 'Claude usage limit reached. Your limit resets at 8am.' }), stderr: '' });
    const r = await auditBatch({ root, ids, audit: 1, concurrency: 1, check: () => 'ok', exec: limit });
    expect(r.stop).toBe('limit');
    expect(r.cards.every((c) => c.coverage === null)).toBe(true);
  });
});
