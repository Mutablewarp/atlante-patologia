// scripts/agent/run-stage.mjs and run-batch.mjs with a fake `claude`: the arguments, the handling of the report, the guard on written
// paths, the usage log, the usage limit, and the order, concurrency and stops of a batch. No model is called.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { line, runBatch } from '../scripts/agent/run-batch.mjs';
import { allowedWrite, BUDGET, claudeArgs, lastJsonObject, limitHit, parseClaudeJson, promptFor, RUN_STAGES, runStage, snapshot, TOOLS, violations } from '../scripts/agent/run-stage.mjs';

const tools = TOOLS as Record<string, string[]>;
const budgets = BUDGET as Record<string, number>;
const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('GIT_')));
const put = (root: string, path: string, text: string) => {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), text);
};

/** A git repo with the role cards, one other card, and .work/ ignored. */
function repo() {
  const root = mkdtempSync(join(tmpdir(), 'run-stage-'));
  const git = (...a: string[]) => {
    const r = spawnSync('git', ['-C', root, ...a], { encoding: 'utf8', env: { ...env, GIT_CEILING_DIRECTORIES: dirname(root) } });
    if (r.status !== 0) throw new Error(`git ${a[0]}: ${r.stderr}`);
  };
  git('init', '-q');
  git('config', 'user.email', 't@example.org');
  git('config', 'user.name', 't');
  git('config', 'commit.gpgsign', 'false');
  put(root, '.gitignore', '.work/\n');
  for (const s of RUN_STAGES) put(root, `docs/agents/roles/${s}.md`, `role ${s}\n`);
  put(root, 'src/content/entities/other/en.md', 'other card\n');
  git('add', '-A');
  git('commit', '-q', '-m', 'init');
  return root;
}

const claudeJson = (over: object = {}) =>
  JSON.stringify({ type: 'result', subtype: 'success', is_error: false, num_turns: 12, total_cost_usd: 0.43214, result: 'done', usage: { input_tokens: 3, cache_creation_input_tokens: 100, cache_read_input_tokens: 2000, output_tokens: 50 }, ...over });
type Exec = (cmd: string, args: string[], opts?: { cwd?: string; timeoutMs?: number; env?: NodeJS.ProcessEnv }) => Promise<{ status: number; stdout: string; stderr: string }>;
/** A fake `claude`: does `act` as the agent's work, then prints `out`. */
const agent = (act: () => void, out: string = claudeJson(), status = 0): Exec => async () => {
  act();
  return { status, stdout: out, stderr: '' };
};
const report = (root: string, id: string, stage: string, over: object = {}) => put(root, `.work/reports/${id}.${stage}.json`, JSON.stringify({ id, stage, status: 'done', note: 'ok', files: [], ...over }));
const clock = () => {
  let t = 0;
  return () => new Date(Date.UTC(2026, 10, 12, 22, 0, 0) + (t += 90_000));
};
const readJson = (root: string, path: string) => JSON.parse(readFileSync(join(root, path), 'utf8'));

describe('claudeArgs and promptFor', () => {
  it('runs lean: no user settings, skills or MCP servers, only the stage tools, edits accepted, JSON out, a budget', () => {
    const a = claudeArgs({ stage: 'author', prompt: 'P' });
    expect(a.slice(0, 2)).toEqual(['-p', 'P']);
    for (const flag of ['--disable-slash-commands', '--strict-mcp-config', '--no-session-persistence']) expect(a).toContain(flag);
    expect(a[a.indexOf('--setting-sources') + 1]).toBe('project');
    expect(a[a.indexOf('--permission-mode') + 1]).toBe('acceptEdits');
    expect(a[a.indexOf('--output-format') + 1]).toBe('json');
    expect(a[a.indexOf('--model') + 1]).toBe('sonnet');
    expect(a[a.indexOf('--max-budget-usd') + 1]).toBe(String(budgets.author));
    expect(a[a.indexOf('--tools') + 1]).toBe('Read,Write,Edit,Grep,Glob,Bash');
    expect(a[a.indexOf('--allowedTools') + 1]).toContain('Bash(npm run card:check:*)');
    expect(a).not.toContain('--add-dir');
  });

  it('gives the web and curl only to the scout and the sources roles', () => {
    for (const s of RUN_STAGES) {
      const wide = tools[s]!.some((t) => /^(WebFetch|WebSearch|Bash\(curl)/.test(t));
      expect(wide).toBe(s === 'scout' || s === 'sources');
    }
  });

  it('has tools and a budget for every stage that has a role card, and a card:check for the six stages', () => {
    for (const s of RUN_STAGES) {
      expect(tools[s]!.length).toBeGreaterThan(0);
      expect(budgets[s]).toBeGreaterThan(0);
    }
    for (const s of RUN_STAGES.filter((x: string) => x !== 'sources')) expect(tools[s]).toContain('Bash(npm run card:check:*)');
  });

  it('adds the real .work directory when .work is a link, and takes a budget and a model', () => {
    const a = claudeArgs({ stage: 'fixer', prompt: 'P', addDir: '/x/.work', budget: 7, model: 'opus' });
    expect(a.slice(-2)).toEqual(['--add-dir', '/x/.work']);
    expect(a[a.indexOf('--max-budget-usd') + 1]).toBe('7');
    expect(a[a.indexOf('--model') + 1]).toBe('opus');
  });

  it('names the card, the stage, the brief and the role card, and adds the note', () => {
    const p = promptFor('foo', 'verifier', 'check c012 twice');
    expect(p).toContain('verifier agent');
    expect(p).toContain('Card id: foo');
    expect(p).toContain('docs/agents/BRIEF.md');
    expect(p).toContain('docs/agents/roles/verifier.md');
    expect(p).toContain('.work/packets/foo/');
    expect(p).toContain('Task note: check c012 twice');
    expect(promptFor('foo', 'verifier')).not.toContain('Task note');
  });
});

describe('the parsing helpers', () => {
  it('parseClaudeJson reads an object, and gives null for anything else', () => {
    expect(parseClaudeJson('{"a":1}')).toEqual({ a: 1 });
    expect(parseClaudeJson('not json')).toBeNull();
    expect(parseClaudeJson('')).toBeNull();
  });

  it('lastJsonObject takes the last top-level object of a message', () => {
    expect(lastJsonObject('Done. {"id":"a","status":"done"} Thanks.')).toEqual({ id: 'a', status: 'done' });
    expect(lastJsonObject('x {"a":1} y {"b":{"c":2}}')).toEqual({ b: { c: 2 } });
    expect(lastJsonObject('no object here')).toBeNull();
    expect(lastJsonObject(undefined)).toBeNull();
  });

  it('limitHit sees a usage limit on an error or on stderr, and nothing else', () => {
    expect(limitHit({ is_error: true, result: 'Claude usage limit reached. Your limit resets at 8am.' })).toBe(true);
    expect(limitHit({ is_error: false, result: 'the usage limit of this rule' })).toBe(false);
    expect(limitHit(null, 'Error: rate limit exceeded')).toBe(true);
    expect(limitHit({ is_error: true, result: 'boom' })).toBe(false);
  });
});

describe('the guard on written paths', () => {
  it('allows the card folder, its ledger and its image records; the image files only for the scout', () => {
    const author = allowedWrite('foo', 'author');
    for (const p of ['src/content/entities/foo/en.md', 'docs/ledger/foo.yaml', 'src/content/images/foo-micro-1.yaml']) expect(author(p)).toBe(true);
    for (const p of ['src/content/entities/foobar/en.md', 'docs/ledger/foobar.yaml', 'scripts/a.mjs', 'src/content/sources.yaml', 'src/assets/images/foo-micro-1.jpg']) expect(author(p)).toBe(false);
    expect(allowedWrite('foo', 'scout')('src/assets/images/foo-micro-1.jpg')).toBe(true);
  });

  it('violations: changed or new paths outside the card, and deleted ones, sorted; a file that was already dirty and did not change is fine', () => {
    const before = new Map([['src/content/entities/other/en.md', ' M:aaa'], ['notes.txt', '??:bbb'], ['old.txt', '??:ooo']]);
    const after = new Map([['src/content/entities/other/en.md', ' M:aaa'], ['notes.txt', '??:ccc'], ['src/content/entities/foo/en.md', '??:ddd'], ['scripts/x.mjs', '??:eee']]);
    expect(violations(before, after, 'foo', 'author')).toEqual(['notes.txt', 'old.txt', 'scripts/x.mjs']);
  });

  it('snapshot lists changed and untracked files with a content hash, and not ignored files', () => {
    const root = repo();
    put(root, 'src/content/entities/foo/en.md', 'one');
    put(root, '.work/x.json', 'ignored');
    const first = snapshot(root);
    expect([...first.keys()]).toEqual(['src/content/entities/foo/en.md']);
    put(root, 'src/content/entities/foo/en.md', 'two');
    expect(snapshot(root).get('src/content/entities/foo/en.md')).not.toBe(first.get('src/content/entities/foo/en.md'));
  });
});

describe('runStage', () => {
  const id = 'foo';
  const run = (root: string, exec: Exec, over: object = {}) => runStage({ root, id, stage: 'author', exec, now: clock(), bin: 'claude', ...over });

  it('records a done stage: the report, the state, and a usage line with the cost and the tokens', async () => {
    const root = repo();
    const r = await run(root, agent(() => { put(root, 'src/content/entities/foo/en.md', 'x'); report(root, id, 'author', { claims: 3 }); }));
    expect(r).toMatchObject({ id, stage: 'author', status: 'done', costUsd: 0.4321, turns: 12, seconds: 90 });
    expect(readJson(root, '.work/state/foo.json')).toMatchObject({ id, stage: 'author', status: 'done' });
    const usage = readFileSync(join(root, '.work/usage.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
    expect(usage).toEqual([expect.objectContaining({ id, stage: 'author', status: 'done', costUsd: 0.4321, turns: 12, input: 3, cacheCreate: 100, cacheRead: 2000, output: 50 })]);
  });

  it('runs the command in the root with the lean arguments and the card as the task', async () => {
    const root = repo();
    const calls: { cmd: string; args: string[]; cwd?: string }[] = [];
    await run(root, async (cmd, args, opts) => {
      calls.push({ cmd, args, cwd: opts?.cwd });
      report(root, id, 'author');
      return { status: 0, stdout: claudeJson(), stderr: '' };
    });
    expect(calls).toHaveLength(1);
    expect(calls[0]!.cwd).toBe(root);
    expect(calls[0]!.cmd).toBe('claude');
    expect(calls[0]!.args[1]).toBe(promptFor(id, 'author'));
  });

  it('removes a report an earlier run left, so a run that writes none is blocked', async () => {
    const root = repo();
    report(root, id, 'author');
    const r = await run(root, agent(() => {}, claudeJson({ result: 'I could not do it' })));
    expect(r).toMatchObject({ status: 'blocked', note: 'no report (success)' });
    expect(readJson(root, '.work/reports/foo.author.json')).toMatchObject({ status: 'blocked' });
    expect(existsSync(join(root, '.work/state/foo.json'))).toBe(false);
  });

  it('takes the report from the final message when the agent did not write the file', async () => {
    const root = repo();
    const message = `Finished. ${JSON.stringify({ id, stage: 'author', status: 'done', note: 'from message', files: [] })}`;
    const r = await run(root, agent(() => {}, claudeJson({ result: message })));
    expect(r).toMatchObject({ status: 'done', note: 'from message' });
    expect(readJson(root, '.work/reports/foo.author.json').note).toBe('from message');
  });

  it('keeps a blocked report as blocked, with its note, and records no state', async () => {
    const root = repo();
    const r = await run(root, agent(() => report(root, id, 'author', { status: 'blocked', note: 'card:check gate verbatim' })));
    expect(r).toMatchObject({ status: 'blocked', note: 'card:check gate verbatim' });
    expect(existsSync(join(root, '.work/state/foo.json'))).toBe(false);
  });

  it('blocks a report that fails validation', async () => {
    const root = repo();
    const r = await run(root, agent(() => report(root, id, 'author', { id: 'bar' })));
    expect(r.status).toBe('blocked');
    expect(r.note).toMatch(/^invalid report: id is "bar"/);
    expect(existsSync(join(root, '.work/state/foo.json'))).toBe(false);
  });

  it('blocks a stage that wrote outside its card, names the paths, and leaves a blocked report', async () => {
    const root = repo();
    const r = await run(root, agent(() => {
      put(root, 'src/content/entities/foo/en.md', 'x');
      put(root, 'scripts/evil.mjs', 'x');
      put(root, 'src/content/entities/other/en.md', 'changed');
      report(root, id, 'author');
    }));
    expect(r.status).toBe('blocked');
    expect(r.note).toBe('wrote outside the card: scripts/evil.mjs, src/content/entities/other/en.md');
    expect(existsSync(join(root, '.work/state/foo.json'))).toBe(false);
    expect(readJson(root, '.work/reports/foo.author.json')).toMatchObject({ status: 'blocked' });
  });

  it('stops on a usage limit: status limit, a blocked report on disk, nothing recorded', async () => {
    const root = repo();
    const out = claudeJson({ is_error: true, subtype: 'error_during_execution', result: 'Claude usage limit reached. Your limit resets at 8am.' });
    const r = await run(root, agent(() => {}, out, 1));
    expect(r).toMatchObject({ status: 'limit', note: 'usage limit reached' });
    expect(readJson(root, '.work/reports/foo.author.json')).toMatchObject({ status: 'blocked' });
    expect(existsSync(join(root, '.work/state/foo.json'))).toBe(false);
  });

  it('logs a failed run too, also when the command printed no JSON', async () => {
    const root = repo();
    const r = await run(root, agent(() => {}, 'not json', 127));
    expect(r).toMatchObject({ status: 'blocked', note: 'no report (exit 127)', costUsd: 0, turns: 0 });
    expect(readFileSync(join(root, '.work/usage.jsonl'), 'utf8')).toContain('"status":"blocked"');
  });

  it('does not write the state of the sources stage (it is not one of the six)', async () => {
    const root = repo();
    const r = await run(root, agent(() => report(root, id, 'sources', { sources: [], gaps: 0 })), { stage: 'sources' });
    expect(r.status).toBe('done');
    expect(existsSync(join(root, '.work/state/foo.json'))).toBe(false);
  });

  it('refuses a bad card id, an unknown stage and a missing role card', async () => {
    const root = repo();
    await expect(run(root, agent(() => {}), { id: '../x' })).rejects.toThrow(/not a card id/);
    await expect(run(root, agent(() => {}), { stage: 'integrator' })).rejects.toThrow(/not a card id/);
    await expect(run(mkdtempSync(join(tmpdir(), 'empty-')), agent(() => {}))).rejects.toThrow(/author\.md not found/);
  });
});

describe('runBatch', () => {
  type Call = { id: string; stage: string };
  const ok = (id: string, stage: string, costUsd = 1) => ({ id, stage, status: 'done', costUsd });

  it('runs each card from its stage to --until, in order', async () => {
    const calls: string[] = [];
    const out = await runBatch({
      queue: [{ id: 'a', from: 'verifier' }, { id: 'b', from: 'author' }],
      concurrency: 1,
      until: 'fixer',
      run: async ({ id, stage }: Call) => {
        calls.push(`${stage}:${id}`);
        return ok(id, stage);
      },
    });
    expect(calls).toEqual(['verifier:a', 'fixer:a', 'author:b', 'translator:b', 'verifier:b', 'fixer:b']);
    expect(out).toMatchObject({ spent: 6, stop: null });
    expect(out.results).toHaveLength(6);
  });

  it('runs at most `concurrency` cards at once, and the stages of one card one after the other', async () => {
    let live = 0;
    let peak = 0;
    const order: string[] = [];
    await runBatch({
      queue: ['a', 'b', 'c', 'd'].map((id) => ({ id, from: 'author' })),
      concurrency: 2,
      until: 'translator',
      run: async ({ id, stage }: Call) => {
        live++;
        peak = Math.max(peak, live);
        order.push(`${id}:${stage}`);
        await new Promise((resolve) => setTimeout(resolve, 5));
        live--;
        return ok(id, stage);
      },
    });
    expect(peak).toBe(2);
    for (const id of 'abcd') expect(order.filter((s) => s.startsWith(`${id}:`))).toEqual([`${id}:author`, `${id}:translator`]);
  });

  it('stops a blocked card and goes on with the others', async () => {
    const calls: string[] = [];
    const out = await runBatch({
      queue: [{ id: 'a', from: 'author' }, { id: 'b', from: 'author' }],
      concurrency: 1,
      until: 'translator',
      run: async ({ id, stage }: Call) => {
        calls.push(`${stage}:${id}`);
        return id === 'a' ? { id, stage, status: 'blocked', costUsd: 1 } : ok(id, stage);
      },
    });
    expect(calls).toEqual(['author:a', 'author:b', 'translator:b']);
    expect(out.stop).toBeNull();
  });

  it('stops everything at a usage limit', async () => {
    const calls: string[] = [];
    const out = await runBatch({
      queue: ['a', 'b', 'c'].map((id) => ({ id, from: 'author' })),
      concurrency: 1,
      run: async ({ id, stage }: Call) => {
        calls.push(`${stage}:${id}`);
        return id === 'b' ? { id, stage, status: 'limit', costUsd: 0 } : ok(id, stage);
      },
    });
    expect(out.stop).toBe('limit');
    expect(calls).toEqual(['author:a', 'translator:a', 'verifier:a', 'fixer:a', 'questions:a', 'scout:a', 'author:b']);
  });

  it('stops launching stages once the budget is spent', async () => {
    const out = await runBatch({ queue: [{ id: 'a', from: 'author' }], concurrency: 1, budgetUsd: 5, run: async ({ id, stage }: Call) => ok(id, stage, 2) });
    expect(out).toMatchObject({ stop: 'budget', spent: 6 });
    expect(out.results).toHaveLength(3);
  });

  it('prints one line per stage', () => {
    expect(line({ id: 'foo', stage: 'author', status: 'done', costUsd: 0.5, turns: 30, seconds: 120, note: 'ok' })).toBe('author foo: done, $0.5, 30 turns, 120s: ok');
    expect(line({ id: 'foo', stage: 'scout', status: 'blocked' })).toBe('scout foo: blocked, $0, 0 turns, 0s');
  });
});
