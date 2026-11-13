#!/usr/bin/env node
/**
 * One code task on a lean agent (docs/agents/roles/coder.md; the tasks of the interactive body are in plan/body-tasks.md):
 *   node scripts/agent/run-task.mjs <task-id> [--file plan/body-tasks.md] [--siblings B-0b,B-0d] [--budget 5] [--model sonnet] [--note "..."]
 * The task is the section "### <task-id>: title" of the tasks file. Its "Files:" line lists what the agent may write: a file, or a
 * folder ending in "/". Afterwards the script checks that nothing else changed (the files of `--siblings`, tasks that run at the
 * same time, are allowed), validates the report .work/reports/<task-id>.coder.json and appends the cost to .work/usage.jsonl.
 * It commits nothing. Exit code: 0 done, 1 blocked, 3 usage limit reached.
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cli, option, ROOT } from './record.mjs';
import { changedPaths, claudeArgs, execute, lastJsonObject, limitHit, parseClaudeJson, snapshot, usageLine } from './run-stage.mjs';

/** The section "### <id>: title" of a tasks file, up to the next heading of level 2 or 3; null when there is none. */
export function taskSection(text, id) {
  const lines = text.split('\n');
  const start = lines.findIndex((l) => l.startsWith(`### ${id}: `));
  if (start < 0) return null;
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((l) => /^#{2,3} /.test(l));
  return [lines[start], ...(end < 0 ? rest : rest.slice(0, end))].join('\n').trim();
}

/** The paths of a task's "Files:" line. */
export const taskFiles = (section) => (/^Files:(.*)$/m.exec(section ?? '')?.[1] ?? '').split(',').map((f) => f.trim()).filter(Boolean);

const mayWrite = (files) => (path) => files.some((f) => (f.endsWith('/') ? path.startsWith(f) : path === f));

/** The task message: the role card to follow, the head of the tasks file (it names the spec), and the task's own section. */
export function taskPrompt(id, section, file, head = '', note = '') {
  return [
    `You are the coder agent of the Atlante. Task id: ${id}.`,
    'Read docs/agents/BRIEF.md rules 1, 3, 4, 7, 10 and 11, then follow docs/agents/roles/coder.md exactly.',
    head && `From the head of ${file} (read the spec it names before you write code):\n${head}`,
    `Your task. You may write only the paths on its "Files:" line and the report .work/reports/${id}.coder.json:\n${section}`,
    'The only shell commands you may run are the ones the role card names. Your final message must be only the JSON object the role card asks for.',
    note && `Task note: ${note}`,
  ].filter(Boolean).join('\n\n');
}

const json = (text) => {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

/**
 * Runs one task. `exec(command, args, { cwd })` returns { status, stdout, stderr } (tests replace it).
 * Resolves { id, stage: 'coder', status: 'done' | 'blocked' | 'limit', note, costUsd, turns, seconds }; throws only for a task that cannot start.
 */
export async function runTask({ root = ROOT, id, file = 'plan/body-tasks.md', siblings = [], budget = undefined, model = undefined, note = '', exec = execute, now = () => new Date(), bin = process.env.CLAUDE_BIN || 'claude' }) {
  if (!/^[A-Za-z0-9]+(-[A-Za-z0-9]+)*$/.test(id ?? '')) throw new Error(`"${id}" is not a task id`);
  const text = readFileSync(join(root, file), 'utf8');
  const section = taskSection(text, id);
  if (!section) throw new Error(`${file} has no section "### ${id}: "`);
  const files = taskFiles(section);
  if (!files.length) throw new Error(`task ${id} has no "Files:" line: it is a lead task, or its brief is incomplete`);
  const allowed = mayWrite([...files, ...siblings.flatMap((s) => taskFiles(taskSection(text, s)))]);
  const work = join(root, '.work');
  const real = existsSync(work) ? realpathSync(work) : null;
  const reportPath = join(work, 'reports', `${id}.coder.json`);
  mkdirSync(join(work, 'reports'), { recursive: true });
  rmSync(reportPath, { force: true }); // a report left by an earlier run must not pass for this one
  const before = snapshot(root);
  const started = now();
  const prompt = taskPrompt(id, section, file, text.split(/^## /m)[0].trim(), note);
  const run = await exec(bin, claudeArgs({ stage: 'coder', prompt, budget, model, addDir: real && real !== work ? real : null }), { cwd: root });
  const seconds = Math.round((now() - started) / 1000);
  const j = parseClaudeJson(run.stdout);

  const report = (existsSync(reportPath) ? json(readFileSync(reportPath, 'utf8')) : null) ?? lastJsonObject(j?.result);
  const blocked = (why) => ({ id, stage: 'coder', status: 'blocked', note: why.slice(0, 200) });
  let outcome;
  if (limitHit(j, run.stderr)) outcome = { ...blocked('usage limit reached'), status: 'limit' };
  else if (!report) outcome = blocked(`no report (${j?.subtype ?? `exit ${run.status}`})${j?.result ? `: ${String(j.result).replace(/\s+/g, ' ').slice(0, 120)}` : ''}`);
  else if (report.id !== id || report.stage !== 'coder' || !['done', 'blocked'].includes(report.status)) outcome = blocked(`invalid report: id "${report.id}", stage "${report.stage}", status "${report.status}"`);
  else {
    const stray = changedPaths(before, snapshot(root)).filter((p) => !allowed(p)).sort();
    outcome = stray.length
      ? blocked(`wrote outside the task: ${stray.slice(0, 3).join(', ')}${stray.length > 3 ? ` (+${stray.length - 3})` : ''}`)
      : { id, stage: 'coder', status: report.status, note: String(report.note ?? '').slice(0, 200) };
  }
  if (outcome.status === 'done') writeFileSync(reportPath, `${JSON.stringify({ ...report, note: outcome.note })}\n`);
  else {
    if (report) writeFileSync(join(work, 'reports', `${id}.coder.agent.json`), `${JSON.stringify(report)}\n`); // keep what the agent wrote
    writeFileSync(reportPath, `${JSON.stringify({ id, stage: 'coder', status: 'blocked', note: outcome.note, files: [] })}\n`);
  }
  const usage = usageLine({ id, stage: 'coder', status: outcome.status, j, seconds, now: now() });
  appendFileSync(join(work, 'usage.jsonl'), `${JSON.stringify(usage)}\n`);
  return { ...outcome, costUsd: usage.costUsd, turns: usage.turns, seconds };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  cli('run-task', () => {
    const id = args[0];
    if (!id || id.startsWith('--')) throw new Error('usage: node scripts/agent/run-task.mjs <task-id> [--file plan/body-tasks.md] [--siblings B-0b,B-0d] [--budget 5] [--model sonnet] [--note "..."]');
    const budget = option(args, '--budget');
    const siblings = (option(args, '--siblings', '') ?? '').split(',').filter(Boolean);
    runTask({ id, file: option(args, '--file', 'plan/body-tasks.md'), siblings, budget: budget === undefined ? undefined : Number(budget), model: option(args, '--model'), note: option(args, '--note', '') })
      .then((r) => {
        console.log(`coder ${r.id}: ${r.status}, $${r.costUsd}, ${r.turns} turns, ${r.seconds}s${r.note ? `: ${r.note}` : ''}`);
        process.exitCode = r.status === 'done' ? 0 : r.status === 'limit' ? 3 : 1;
      })
      .catch((e) => {
        console.error(`run-task: ${e.message}`);
        process.exitCode = 2;
      });
  });
}
