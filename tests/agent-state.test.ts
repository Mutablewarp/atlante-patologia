// Agent pipeline state: scripts/agent/record.mjs, next.mjs and content-batch.workflow.js on handwritten fixtures in temp
// directories (docs/agents/CONTRACTS.md §3 and §5). Nothing here reads or writes the real .work/, and no git runs.
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { next } from '../scripts/agent/next.mjs';
import { record, STAGES, stageFrom, validateReport } from '../scripts/agent/record.mjs';

const script = (name: string) => fileURLToPath(new URL(`../scripts/agent/${name}`, import.meta.url));

let root = '';
beforeEach(() => {
  root = realpathSync(mkdtempSync(join(tmpdir(), 'agent-state-')));
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

const put = (rel: string, text: string) => {
  mkdirSync(dirname(join(root, rel)), { recursive: true });
  writeFileSync(join(root, rel), text);
};
const VERDICT = { claim: 'alpha-c001', verdict: 'supported', locator: 'p. 41' };
const writeReport = (id: string, stage: string, extra: Record<string, unknown> = {}) =>
  put(
    `.work/reports/${id}.${stage}.json`,
    JSON.stringify({ id, stage, status: 'done', note: 'ok', files: [], ...(stage === 'verifier' ? { verdicts: [VERDICT] } : {}), ...extra }),
  );
/** Done reports for the first n stages of a card. */
const finish = (id: string, n = STAGES.length) => STAGES.slice(0, n).forEach((s) => writeReport(id, s));
const state = (id: string) => JSON.parse(readFileSync(join(root, '.work/state', `${id}.json`), 'utf8'));
const copyScripts = (...names: string[]) => {
  mkdirSync(join(root, 'scripts/agent'), { recursive: true });
  for (const n of names) copyFileSync(script(n), join(root, 'scripts/agent', n));
};

describe('validateReport (CONTRACTS §3)', () => {
  const ok = { id: 'alpha', stage: 'author', status: 'done', note: 'wrote the card', files: ['src/content/entities/alpha/en.md'] };

  it('accepts the contract example, and a report without note or files', () => {
    expect(validateReport(ok, 'alpha', 'author')).toEqual([]);
    expect(validateReport({ id: 'alpha', stage: 'author', status: 'blocked' }, 'alpha', 'author')).toEqual([]);
  });

  const bad: [string, unknown, RegExp][] = [
    ['another id', { ...ok, id: 'beta' }, /id/],
    ['another stage', { ...ok, stage: 'fixer' }, /stage/],
    ['an unknown status', { ...ok, status: 'ok' }, /status/],
    ['a note over 200 characters', { ...ok, note: 'x'.repeat(201) }, /note/],
    ['files that are not a list of paths', { ...ok, files: [1] }, /files/],
    ['an array', [], /JSON object/],
  ];
  it.each(bad)('rejects %s', (_, report, message) => {
    const problems = validateReport(report, 'alpha', 'author');
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(message);
  });

  describe('the verifier verdicts', () => {
    const v = { id: 'alpha', stage: 'verifier', status: 'done', verdicts: [VERDICT] };
    const fix = { en: 'new text', it: 'nuovo testo', ledger: 'new statement' };

    it('accepts verdicts of the five kinds, with a fix only when the claim is not supported', () => {
      expect(validateReport(v, 'alpha', 'verifier')).toEqual([]);
      for (const verdict of ['partly-supported', 'unsupported', 'contradicted', 'close-paraphrase']) {
        expect(validateReport({ ...v, verdicts: [{ claim: 'alpha-c002', verdict, locator: 'p. 3', fix }] }, 'alpha', 'verifier')).toEqual([]);
      }
    });

    it('accepts a blocked verifier without verdicts', () => {
      expect(validateReport({ ...v, status: 'blocked', verdicts: undefined }, 'alpha', 'verifier')).toEqual([]);
    });

    const bad: [string, unknown, RegExp][] = [
      ['no verdicts', undefined, /verdicts/],
      ['an empty list of verdicts', [], /verdicts/],
      ['an unknown verdict', [{ ...VERDICT, verdict: 'maybe' }], /verdict/],
      ['a fix on a supported claim', [{ ...VERDICT, fix }], /fix/],
      ['a verdict without a claim id', [{ verdict: 'supported', locator: 'p. 1' }], /claim/],
    ];
    it.each(bad)('rejects %s', (_, verdicts, message) => {
      const problems = validateReport({ ...v, verdicts }, 'alpha', 'verifier');
      expect(problems).toHaveLength(1);
      expect(problems[0]).toMatch(message);
    });
  });
});

describe('stageFrom', () => {
  it('is the first stage without a done report, and null when all six are done', () => {
    expect(stageFrom(root, 'alpha')).toBe('author');
    finish('alpha', 2);
    expect(stageFrom(root, 'alpha')).toBe('verifier');
    finish('alpha');
    expect(stageFrom(root, 'alpha')).toBeNull();
  });

  it('does not count a blocked report, a report of another card or an unreadable one', () => {
    writeReport('alpha', 'author', { status: 'blocked' });
    expect(stageFrom(root, 'alpha')).toBe('author');
    writeReport('alpha', 'author', { id: 'beta' });
    expect(stageFrom(root, 'alpha')).toBe('author');
    put('.work/reports/alpha.author.json', '{not json');
    expect(stageFrom(root, 'alpha')).toBe('author');
  });
});

describe('record', () => {
  const now = new Date('2026-11-12T10:00:00Z');

  it('writes .work/state/<id>.json from a valid report', () => {
    writeReport('alpha', 'author');
    expect(record(root, 'alpha', 'author', now)).toMatchObject({ ok: true, problems: [] });
    expect(state('alpha')).toEqual({ id: 'alpha', stage: 'author', status: 'done', updated: '2026-11-12T10:00:00.000Z' });
  });

  it('keeps the last recorded stage, and records a blocked report as blocked', () => {
    writeReport('alpha', 'author');
    writeReport('alpha', 'translator', { status: 'blocked', note: 'no source' });
    record(root, 'alpha', 'author', now);
    expect(record(root, 'alpha', 'translator', now).ok).toBe(true);
    expect(state('alpha')).toMatchObject({ stage: 'translator', status: 'blocked' });
  });

  it('writes nothing for a missing or an invalid report, and says why', () => {
    const missing = record(root, 'alpha', 'author', now);
    expect(missing.ok).toBe(false);
    expect(missing.problems[0]).toMatch(/no report/);
    writeReport('alpha', 'author', { status: 'finished' });
    const invalid = record(root, 'alpha', 'author', now);
    expect(invalid.ok).toBe(false);
    expect(invalid.problems[0]).toMatch(/status/);
    expect(existsSync(join(root, '.work/state/alpha.json'))).toBe(false);
  });

  it('refuses ids and stages that would leave .work/', () => {
    expect(record(root, '../x', 'author', now).ok).toBe(false);
    expect(record(root, 'alpha', 'sleep', now).ok).toBe(false);
  });
});

describe('the record CLI', () => {
  const run = (...args: string[]) => spawnSync(process.execPath, [join(root, 'scripts/agent/record.mjs'), ...args], { encoding: 'utf8' });
  beforeEach(() => copyScripts('record.mjs'));

  it('prints one line and exits 0 for a good report', () => {
    writeReport('alpha', 'author');
    const r = run('alpha', 'author');
    expect([r.status, r.stdout]).toEqual([0, 'record alpha author: done\n']);
    expect(state('alpha').stage).toBe('author');
  });

  it('exits 1 with the problems for a bad report, and 2 for a call without arguments', () => {
    writeReport('alpha', 'author', { note: 'x'.repeat(201) });
    const bad = run('alpha', 'author');
    expect(bad.status).toBe(1);
    expect(bad.stderr).toMatch(/1 problem.*\n.*note/);
    expect(run('alpha').status).toBe(2);
  });
});

describe('next (CONTRACTS §5)', () => {
  const ROWS = [
    { id: 'a-p1', batch: 'W02', priority: 'P1', published: false },
    { id: 'b-p0', batch: 'W02', priority: 'P0', published: false },
    { id: 'c-p2', batch: 'W02', priority: 'P2', published: false },
    { id: 'd-p0', batch: 'W02', priority: 'P0', published: false },
    { id: 'e-published', batch: 'W02', priority: 'P0', published: true },
    { id: 'f-finished', batch: 'W02', priority: 'P0', published: false },
    { id: 'g-other-batch', batch: 'W03', priority: 'P0', published: false },
    { id: 'h-pattern', batch: 'W02', kind: 'pattern', priority: 'P0', published: false }, // a comparison page: no flow yet, never queued
  ];
  const PACKET = ['row.json', 'source.txt', 'vocab.json', 'NOTES.md'];
  const makePacket = (id: string) => PACKET.forEach((f) => put(`.work/packets/${id}/${f}`, 'x'));

  beforeEach(() => {
    put('.work/manifest.json', JSON.stringify(ROWS));
    finish('b-p0', 2); // author and translator done
    finish('d-p0', 1);
    writeReport('d-p0', 'translator', { status: 'blocked', note: 'stuck' });
    finish('f-finished');
  });

  /** A packet builder that writes the packet files, and remembers what it was asked for. */
  const builder = (failing: string[] = []) => {
    const built: string[] = [];
    return {
      built,
      buildPacket: (id: string) => {
        built.push(id);
        if (failing.includes(id)) return 'cannot cut the pages';
        makePacket(id);
        return null;
      },
    };
  };

  it('takes the cards of the batch in manifest order, P0 first, and skips published and finished cards', () => {
    const { buildPacket } = builder();
    const out = next(root, { batch: 'W02', buildPacket });
    expect(out.packets).toBe('.work/packets');
    expect(out.cards).toEqual([
      { id: 'b-p0', from: 'verifier' },
      { id: 'd-p0', from: 'translator' },
      { id: 'a-p1', from: 'author' },
      { id: 'c-p2', from: 'author' },
    ]);
    expect(out.problems).toEqual([]);
  });

  it('stops at --max, and builds packets only for the cards it returns', () => {
    const { buildPacket, built } = builder();
    expect(next(root, { batch: 'W02', max: 2, buildPacket }).cards.map((c: { id: string }) => c.id)).toEqual(['b-p0', 'd-p0']);
    expect(built).toEqual(['b-p0', 'd-p0']);
  });

  it('builds a missing or partial packet, and leaves a complete one alone', () => {
    makePacket('b-p0');
    put('.work/packets/d-p0/row.json', '{}'); // an interrupted build
    const { buildPacket, built } = builder();
    next(root, { batch: 'W02', buildPacket });
    expect(built).toEqual(['d-p0', 'a-p1', 'c-p2']);
  });

  it('leaves out a card whose packet fails, with the reason, and takes the next card instead', () => {
    const { buildPacket } = builder(['b-p0']);
    const out = next(root, { batch: 'W02', max: 2, buildPacket });
    expect(out.cards.map((c: { id: string }) => c.id)).toEqual(['d-p0', 'a-p1']);
    expect(out.problems).toEqual(['b-p0: cannot cut the pages']);
  });

  it('throws for a batch that is not in the manifest', () => {
    expect(() => next(root, { batch: 'W99', buildPacket: () => null })).toThrow(/W99/);
  });

  it('prints { packets, cards } on one line from the CLI', () => {
    copyScripts('record.mjs', 'next.mjs');
    ['b-p0', 'd-p0', 'a-p1', 'c-p2'].forEach(makePacket);
    const r = spawnSync(process.execPath, [join(root, 'scripts/agent/next.mjs'), '--batch', 'W02', '--max', '2'], { encoding: 'utf8' });
    expect(r.status).toBe(0);
    expect(JSON.parse(r.stdout)).toEqual({ packets: '.work/packets', cards: [{ id: 'b-p0', from: 'verifier' }, { id: 'd-p0', from: 'translator' }] });
    expect(r.stdout.trim().split('\n')).toHaveLength(1);
  });

  it('exits 2 without --batch', () => {
    copyScripts('record.mjs', 'next.mjs');
    expect(spawnSync(process.execPath, [join(root, 'scripts/agent/next.mjs')], { encoding: 'utf8' }).status).toBe(2);
  });
});

describe('content-batch.workflow.js', () => {
  type Stage = (prev: unknown, item: unknown, i: number) => unknown;
  const SRC = readFileSync(script('content-batch.workflow.js'), 'utf8');
  // The Workflow tool runs the body as an async function with these globals; `export` is only valid in the meta literal.
  const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor as new (...args: string[]) => (...args: unknown[]) => Promise<unknown>;
  const compile = () => new AsyncFunction('agent', 'pipeline', 'args', 'log', SRC.replace(/^export const meta/m, 'const meta'));

  /** Runs the script with a fake agent; `answer(stage, id)` is what the agent returns. */
  async function run(cards: { id: string; from: string }[], answer: (stage: string, id: string) => unknown, firstPrev: 'item' | 'undefined' = 'item') {
    const calls: { prompt: string; opts: Record<string, unknown> }[] = [];
    const logs: string[] = [];
    const agent = async (prompt: string, opts: { label: string }) => {
      calls.push({ prompt, opts });
      const [stage = '', id = ''] = opts.label.split(':');
      return answer(stage, id);
    };
    const pipeline = (items: unknown[], ...stages: Stage[]) =>
      Promise.all(
        items.map(async (item, i) => {
          let prev: unknown = firstPrev === 'item' ? item : undefined;
          for (const stage of stages) prev = await stage(prev, item, i);
          return prev;
        }),
      );
    const out = (await compile()(agent, pipeline, { packets: '.work/packets', cards }, (m: string) => logs.push(m))) as unknown[];
    return { out, calls, logs };
  }
  const done = (stage: string, id: string) => ({ id, stage, status: 'done' });
  const labels = (calls: { opts: Record<string, unknown> }[]) => calls.map((c) => c.opts.label);

  it('parses as plain JavaScript, and its meta is a literal', () => {
    expect(compile).not.toThrow();
    const literal = SRC.match(/^export const meta = (\{[\s\S]*?\n\})/m)?.[1] ?? '';
    const meta = new Function(`return ${literal}`)();
    expect(meta).toMatchObject({ name: 'content-batch', phases: [{ title: 'Cards' }] });
    expect(typeof meta.description).toBe('string');
  });

  it('runs one agent per card and stage, with the prompt, options and schema of the contract', async () => {
    const { out, calls } = await run([{ id: 'alpha', from: 'author' }], done);
    expect(labels(calls)).toEqual(STAGES.map((s) => `${s}:alpha`));
    expect(calls[2]?.prompt).toBe(
      'Card alpha, stage verifier. Read docs/agents/BRIEF.md and docs/agents/roles/verifier.md, then the packet in .work/packets/alpha/. Return the JSON report only.',
    );
    expect(calls[0]?.opts).toMatchObject({ label: 'author:alpha', phase: 'Cards', model: 'sonnet' });
    const schema = calls[0]?.opts.schema as { type: string; required: string[]; properties: Record<string, Record<string, unknown>> };
    expect(schema.type).toBe('object');
    expect(schema.required).toEqual(['id', 'stage', 'status']);
    expect(schema.properties.status?.enum).toEqual(['done', 'blocked']);
    expect(schema.properties.note?.maxLength).toBe(200);
    expect(out).toEqual([done('scout', 'alpha')]);
  });

  it('skips the stages before `from`', async () => {
    const { calls } = await run([{ id: 'alpha', from: 'verifier' }, { id: 'beta', from: 'scout' }], done);
    expect(labels(calls).sort()).toEqual(['fixer:alpha', 'questions:alpha', 'scout:alpha', 'scout:beta', 'verifier:alpha']);
  });

  it('does not depend on what the first stage receives', async () => {
    const { calls } = await run([{ id: 'alpha', from: 'author' }], done, 'undefined');
    expect(calls).toHaveLength(STAGES.length);
  });

  it('stops a blocked card with its report, logs it, and lets the other cards go on', async () => {
    const blocked = { id: 'beta', stage: 'translator', status: 'blocked', note: 'no source' };
    const { out, calls, logs } = await run(
      [{ id: 'alpha', from: 'author' }, { id: 'beta', from: 'author' }],
      (stage, id) => (id === 'beta' && stage === 'translator' ? blocked : done(stage, id)),
    );
    expect(out).toEqual([done('scout', 'alpha'), blocked]);
    expect(labels(calls).filter((l) => String(l).endsWith(':beta'))).toEqual(['author:beta', 'translator:beta']);
    expect(logs).toEqual(['translator:beta blocked: no source']);
  });

  it('resumes after a forced stop without repeating a stage (next.mjs and the workflow together)', async () => {
    put('.work/manifest.json', JSON.stringify([{ id: 'a', batch: 'W02', priority: 'P0' }, { id: 'b', batch: 'W02', priority: 'P1' }]));
    const buildPacket = (id: string) => {
      for (const f of ['row.json', 'source.txt', 'vocab.json', 'NOTES.md']) put(`.work/packets/${id}/${f}`, 'x');
      return null;
    };
    // First run: the agents write their reports, and the run dies at the fixer.
    const first = await run(next(root, { batch: 'W02', buildPacket }).cards, (stage, id) => {
      if (stage === 'fixer') return null;
      writeReport(id, stage);
      return done(stage, id);
    });
    expect(labels(first.calls)).toContain('fixer:a');
    const resumed = next(root, { batch: 'W02', buildPacket });
    expect(resumed.cards).toEqual([{ id: 'a', from: 'fixer' }, { id: 'b', from: 'fixer' }]);
    const second = await run(resumed.cards, (stage, id) => {
      writeReport(id, stage);
      return done(stage, id);
    });
    expect(labels(second.calls).sort()).toEqual(['fixer:a', 'fixer:b', 'questions:a', 'questions:b', 'scout:a', 'scout:b']);
    expect(next(root, { batch: 'W02', buildPacket }).cards).toEqual([]);
  });

  it('stops a card whose agent was lost (null), and the rest goes on', async () => {
    const { out, calls } = await run([{ id: 'alpha', from: 'author' }, { id: 'beta', from: 'author' }], (stage, id) => (id === 'alpha' ? null : done(stage, id)));
    expect(out[0]).toBeNull();
    expect(out[1]).toEqual(done('scout', 'beta'));
    expect(calls.filter((c) => c.opts.label === 'translator:alpha')).toHaveLength(0);
  });
});
