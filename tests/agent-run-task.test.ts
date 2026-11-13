// scripts/agent/run-task.mjs with a fake `claude`: the task section and its file list, the guard on written paths, the report, the usage limit.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { runTask, taskFiles, taskPrompt, taskSection } from '../scripts/agent/run-task.mjs';

const TASKS = `# Tasks

Spec: \`docs/SPEC.md\` (binding).

## Group one

### T-1a: first task (coder)
Files: scripts/a.mjs, tests/a.test.ts
Goal: write a.

### T-1b: second task (coder)
Depends: T-1a
Files: src/viewer/
Goal: write the viewer.

### T-1c: look at it (lead)
Look.

## Group two
`;

const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('GIT_')));
const put = (root: string, path: string, text: string) => {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), text);
};
/** A git repo with the tasks file and .work/ ignored. */
function repo() {
  const root = mkdtempSync(join(tmpdir(), 'run-task-'));
  const git = (...a: string[]) => {
    const r = spawnSync('git', ['-C', root, ...a], { encoding: 'utf8', env: { ...env, GIT_CEILING_DIRECTORIES: dirname(root) } });
    if (r.status !== 0) throw new Error(`git ${a[0]}: ${r.stderr}`);
  };
  git('init', '-q');
  git('config', 'user.email', 't@example.org');
  git('config', 'user.name', 't');
  git('config', 'commit.gpgsign', 'false');
  put(root, '.gitignore', '.work/\n');
  put(root, 'plan/tasks.md', TASKS);
  git('add', '-A');
  git('commit', '-q', '-m', 'init');
  return root;
}
const claudeJson = (over: object = {}) => JSON.stringify({ type: 'result', subtype: 'success', is_error: false, num_turns: 9, total_cost_usd: 0.31, result: 'done', usage: { input_tokens: 2, output_tokens: 40 }, ...over });
type Exec = (cmd: string, args: string[], opts?: { cwd?: string; timeoutMs?: number; env?: NodeJS.ProcessEnv }) => Promise<{ status: number; stdout: string; stderr: string }>;
const agent = (act: (args: string[]) => void, out: string = claudeJson(), status = 0): Exec => async (_cmd, args) => {
  act(args);
  return { status, stdout: out, stderr: '' };
};
const report = (root: string, id: string, over: object = {}) => put(root, `.work/reports/${id}.coder.json`, JSON.stringify({ id, stage: 'coder', status: 'done', note: 'ok', files: [], ...over }));
const run = (root: string, id: string, exec: Exec, over: object = {}) => runTask({ root, id, file: 'plan/tasks.md', exec, ...over });
const readJson = (root: string, path: string) => JSON.parse(readFileSync(join(root, path), 'utf8'));

describe('taskSection and taskFiles', () => {
  it('takes one task up to the next heading, and its files', () => {
    expect(taskSection(TASKS, 'T-1a')).toBe('### T-1a: first task (coder)\nFiles: scripts/a.mjs, tests/a.test.ts\nGoal: write a.');
    expect(taskSection(TASKS, 'T-1c')).toBe('### T-1c: look at it (lead)\nLook.');
    expect(taskSection(TASKS, 'T-1')).toBeNull();
    expect(taskFiles(taskSection(TASKS, 'T-1a'))).toEqual(['scripts/a.mjs', 'tests/a.test.ts']);
    expect(taskFiles(taskSection(TASKS, 'T-1c'))).toEqual([]);
    expect(taskFiles(null)).toEqual([]);
  });

  it('puts the role card, the head of the file, the section and the note in the prompt', () => {
    const p = taskPrompt('T-1a', 'SECTION', 'plan/tasks.md', 'HEAD', 'mind the gap');
    for (const part of ['Task id: T-1a', 'docs/agents/roles/coder.md', 'HEAD', 'SECTION', '.work/reports/T-1a.coder.json', 'Task note: mind the gap']) expect(p).toContain(part);
  });
});

describe('runTask', () => {
  it('runs the coder tools on the task section, accepts files of the task, and logs the cost', async () => {
    const root = repo();
    let seen: string[] = [];
    const r = await run(root, 'T-1a', agent((args) => {
      seen = args;
      put(root, 'scripts/a.mjs', 'export {}\n');
      put(root, 'tests/a.test.ts', '// test\n');
      report(root, 'T-1a', { note: 'two files' });
    }));
    expect(r).toMatchObject({ id: 'T-1a', stage: 'coder', status: 'done', note: 'two files', costUsd: 0.31, turns: 9 });
    expect(seen[1]).toContain('### T-1a: first task (coder)');
    expect(seen[1]).toContain('Spec: `docs/SPEC.md` (binding).');
    expect(seen[1]).not.toContain('T-1b');
    expect(seen[seen.indexOf('--allowedTools') + 1]).toContain('Bash(npx vitest run:*)');
    expect(readFileSync(join(root, '.work/usage.jsonl'), 'utf8')).toContain('"stage":"coder"');
  });

  it('blocks a task that wrote outside its files, and keeps the agent report beside the blocked one', async () => {
    const root = repo();
    const r = await run(root, 'T-1a', agent(() => {
      put(root, 'scripts/a.mjs', 'x');
      put(root, 'src/viewer/v.ts', 'x');
      report(root, 'T-1a');
    }));
    expect(r).toMatchObject({ status: 'blocked', note: 'wrote outside the task: src/viewer/v.ts' });
    expect(readJson(root, '.work/reports/T-1a.coder.json')).toMatchObject({ status: 'blocked' });
    expect(readJson(root, '.work/reports/T-1a.coder.agent.json')).toMatchObject({ status: 'done' });
  });

  it('allows a folder of the task and the files of a sibling task that runs at the same time', async () => {
    const root = repo();
    const act = () => {
      put(root, 'src/viewer/deep/v.ts', 'x');
      put(root, 'scripts/a.mjs', 'written by the sibling');
      report(root, 'T-1b');
    };
    expect((await run(root, 'T-1b', agent(act), { siblings: ['T-1a'] })).status).toBe('done');
    expect((await run(root, 'T-1b', agent(() => {
      put(root, 'scripts/a.mjs', 'changed again');
      report(root, 'T-1b');
    }))).note).toBe('wrote outside the task: scripts/a.mjs');
  });

  it('takes the report from the final message, and blocks a run without one or with the wrong id', async () => {
    const root = repo();
    const fromMessage = claudeJson({ result: `Done. ${JSON.stringify({ id: 'T-1a', stage: 'coder', status: 'done', note: 'in the message', files: [] })}` });
    expect(await run(root, 'T-1a', agent(() => {}, fromMessage))).toMatchObject({ status: 'done', note: 'in the message' });
    expect(existsSync(join(root, '.work/reports/T-1a.coder.json'))).toBe(true);
    expect(await run(root, 'T-1a', agent(() => {}, claudeJson({ result: 'I stopped' })))).toMatchObject({ status: 'blocked', note: 'no report (success): I stopped' });
    expect((await run(root, 'T-1a', agent(() => report(root, 'T-1a', { id: 'T-9' })))).note).toMatch(/^invalid report: id "T-9"/);
  });

  it('stops on a usage limit with status limit', async () => {
    const root = repo();
    const out = claudeJson({ is_error: true, subtype: 'error_during_execution', result: 'Claude usage limit reached. Your limit resets at 8am.' });
    expect(await run(root, 'T-1a', agent(() => {}, out, 1))).toMatchObject({ status: 'limit', note: 'usage limit reached' });
  });

  it('refuses a lead task, an unknown task and a bad id', async () => {
    const root = repo();
    await expect(run(root, 'T-1c', agent(() => {}))).rejects.toThrow(/no "Files:" line/);
    await expect(run(root, 'T-7', agent(() => {}))).rejects.toThrow(/no section "### T-7: "/);
    await expect(run(root, '../x', agent(() => {}))).rejects.toThrow(/not a task id/);
  });
});
