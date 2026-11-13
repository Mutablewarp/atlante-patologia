#!/usr/bin/env node
/**
 * One lean agent stage of one card (docs/agents/CONTRACTS.md §7):
 *   node scripts/agent/run-stage.mjs <id> <stage> [--budget 4] [--model sonnet] [--note "extra task text"]
 * Runs `claude -p` without plugins, skills, MCP servers or user hooks: about 18k tokens of fixed context per turn, where a workflow
 * agent in this environment pays 121k. The role card is the task. Afterwards the script reads .work/reports/<id>.<stage>.json
 * (or the JSON the agent returned), validates it, checks that only the card's own files changed, records the state, and appends
 * the usage and the cost to .work/usage.jsonl. Exit code: 0 done, 1 blocked, 3 usage limit reached.
 */
import { spawn, spawnSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cli, option, readReport, record, ROOT, STAGES, validateReport } from './record.mjs';

/** The six stages of the state files, plus two that have a role card and a report but no state: `sources` (second sources for gaps) and `distance` (restructuring after the author). */
export const RUN_STAGES = [...STAGES, 'sources', 'distance'];
const FILES = ['Read', 'Write', 'Edit', 'Grep', 'Glob'];
const CHECK = 'Bash(npm run card:check:*)';
const SHA = 'Bash(shasum -a 256:*)'; // translatedFrom of it.md: the translator writes it, the fixer recomputes it after an edit of en.md
/** Tools per stage, least privilege: the shell commands each role card names, and the web only for the two roles that may browse. */
export const TOOLS = {
  author: [...FILES, CHECK],
  translator: [...FILES, CHECK, 'Bash(grep:*)', SHA],
  verifier: [...FILES, CHECK],
  fixer: [...FILES, CHECK, SHA],
  distance: [...FILES, CHECK],
  questions: [...FILES, CHECK],
  scout: [...FILES, CHECK, 'Bash(curl:*)', 'Bash(node scripts/agent/commons-candidates.mjs:*)', 'WebFetch', 'WebSearch'],
  sources: [...FILES, 'Bash(curl:*)', 'Bash(grep:*)', 'Bash(head:*)', 'WebFetch', 'WebSearch'],
  // not a card stage: a code task of run-task.mjs (docs/agents/roles/coder.md names these commands)
  coder: [...FILES, 'Bash(npx vitest run:*)', 'Bash(npx astro check:*)', 'Bash(git diff:*)', 'Bash(git status:*)', 'Bash(wc -l:*)', 'Bash(node scripts/anatomy/:*)'],
};
/** Dollars (API price) a stage may spend: a lean turn costs cents, so a stage past this has lost its way. */
export const BUDGET = { author: 4, translator: 2, verifier: 3, fixer: 3, distance: 4, questions: 2, scout: 3, sources: 2, coder: 5 };
const TIMEOUT_MS = 25 * 60_000;

export function promptFor(id, stage, note = '') {
  return [
    `You are the ${stage} agent of the Atlante content pipeline. Card id: ${id}.`,
    `Read docs/agents/BRIEF.md first, then follow docs/agents/roles/${stage}.md exactly. The packet is in .work/packets/${id}/.`,
    'Write only the paths that role card allows. The only shell commands you may run are the ones the role card names.',
    'Your final message must be only the JSON object the role card asks for.',
    note && `Task note: ${note}`,
  ].filter(Boolean).join('\n');
}

/**
 * The arguments of `claude` for one stage: no user settings, plugins, skills or MCP servers; only the stage's tools; file edits accepted.
 * @param {{ stage: keyof typeof BUDGET, prompt: string, budget?: number, model?: string, addDir?: string | null }} o
 */
export function claudeArgs({ stage, prompt, budget = BUDGET[stage], model = 'sonnet', addDir = undefined }) {
  const tools = TOOLS[stage];
  return [
    '-p', prompt,
    '--model', model,
    '--setting-sources', 'project',
    '--disable-slash-commands',
    '--strict-mcp-config',
    '--tools', [...new Set(tools.map((t) => t.replace(/\(.*$/, '')))].join(','),
    '--allowedTools', tools.join(','),
    '--permission-mode', 'acceptEdits',
    '--no-session-persistence',
    '--output-format', 'json',
    '--max-budget-usd', String(budget),
    ...(addDir ? ['--add-dir', addDir] : []),
  ];
}

/** The JSON object `claude --output-format json` prints; null when stdout holds none. */
export function parseClaudeJson(stdout) {
  try {
    const j = JSON.parse(stdout);
    return j && typeof j === 'object' ? j : null;
  } catch {
    return null;
  }
}

const LIMIT = /usage limit|rate limit|limit reached|weekly limit|5-hour limit|session limit/i;
/** True when the run stopped because the account's usage limit was reached (the batch must stop, not retry). */
export const limitHit = (j, stderr = '') => LIMIT.test(`${j?.is_error ? (j.result ?? '') : ''} ${stderr}`);

/** The last top-level JSON object in the text of an agent's final message, or null. */
export function lastJsonObject(text) {
  const s = String(text ?? '');
  for (let end = s.lastIndexOf('}'); end >= 0; end = s.lastIndexOf('}', end - 1))
    for (let start = s.lastIndexOf('{', end); start >= 0; start = s.lastIndexOf('{', start - 1))
      try {
        const o = JSON.parse(s.slice(start, end + 1));
        if (o && typeof o === 'object' && !Array.isArray(o)) return o;
      } catch {
        /* a shorter or longer span may parse */
      }
  return null;
}

/** Path -> "status:content hash" of every file git sees as changed or untracked (ignored files such as .work/ are not listed). */
export function snapshot(root) {
  const r = spawnSync('git', ['status', '--porcelain=v1', '-z', '-uall'], { cwd: root, encoding: 'utf8', maxBuffer: 1 << 26 });
  if (r.status !== 0) throw new Error(`git status failed in ${root}: ${r.stderr}`);
  const out = new Map();
  const parts = r.stdout.split('\0').filter(Boolean);
  for (let i = 0; i < parts.length; i++) {
    const xy = parts[i].slice(0, 2);
    const path = parts[i].slice(3);
    if (/[RC]/.test(xy)) i++; // a rename or copy is followed by its source path
    const file = join(root, path);
    out.set(path, `${xy}:${existsSync(file) ? createHash('sha1').update(readFileSync(file)).digest('hex') : '-'}`);
  }
  return out;
}

const owns = (id, path) => path.startsWith(`src/content/entities/${id}/`) || path === `docs/ledger/${id}.yaml` || path.startsWith(`src/content/images/${id}-`);

/**
 * What a stage may write besides .work/: the card's own folder and ledger, its image records, and for the scout the image files.
 * `siblings` are the other cards of the batch: they run at the same time in the same worktree, so their files are not a violation.
 */
export const allowedWrite = (id, stage, siblings = []) => (path) =>
  [id, ...siblings].some((c) => owns(c, path)) ||
  (stage === 'scout' && path.startsWith('src/assets/images/')) ||
  siblings.some((c) => path.startsWith(`src/assets/images/${c}-`)); // a sibling's scout may be writing its image files right now

/** Paths that differ between two snapshots: changed, new, or gone. */
export const changedPaths = (before, after) => [...[...after].filter(([p, v]) => before.get(p) !== v).map(([p]) => p), ...[...before].filter(([p]) => !after.has(p)).map(([p]) => p)];

/** Paths that differ between two snapshots and that the stage may not write. */
export function violations(before, after, id, stage, siblings = []) {
  const ok = allowedWrite(id, stage, siblings);
  return changedPaths(before, after).filter((p) => !ok(p)).sort();
}

/** Runs a command without a stdin, with a wall-clock limit; resolves { status, stdout, stderr } and never rejects. */
export function execute(command, args, { cwd, timeoutMs = TIMEOUT_MS, env = process.env } = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => child.kill('SIGTERM'), timeoutMs);
    child.stdout.on('data', (d) => (stdout += d));
    child.stderr.on('data', (d) => (stderr += d));
    child.on('error', (e) => {
      clearTimeout(timer);
      resolve({ status: 127, stdout, stderr: `${stderr}${e.message}` });
    });
    child.on('close', (status, signal) => {
      clearTimeout(timer);
      resolve({ status: status ?? (signal ? 124 : 1), stdout, stderr });
    });
  });
}

const money = (n) => Number((n ?? 0).toFixed(4));

/** One usage line: what the run cost (API prices) and how many tokens of each kind it used. */
export function usageLine({ id, stage, status, j, seconds, now }) {
  const u = j?.usage ?? {};
  return {
    at: now.toISOString(),
    id,
    stage,
    status,
    subtype: j?.subtype ?? null,
    turns: j?.num_turns ?? 0,
    seconds,
    costUsd: money(j?.total_cost_usd),
    input: u.input_tokens ?? 0,
    cacheCreate: u.cache_creation_input_tokens ?? 0,
    cacheRead: u.cache_read_input_tokens ?? 0,
    output: u.output_tokens ?? 0,
  };
}

/**
 * Runs one stage. `exec(command, args, { cwd })` returns { status, stdout, stderr } (tests replace it).
 * Resolves { id, stage, status: 'done' | 'blocked' | 'limit', note, costUsd, turns, seconds }; never throws for a failed agent.
 */
export async function runStage({ root = ROOT, id, stage, budget = undefined, model = undefined, note = '', siblings = [], exec = execute, now = () => new Date(), bin = process.env.CLAUDE_BIN || 'claude' }) {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(id) || !RUN_STAGES.includes(stage)) throw new Error(`"${id}" and "${stage}" are not a card id and one of ${RUN_STAGES.join(', ')}`);
  if (!existsSync(join(root, 'docs/agents/roles', `${stage}.md`))) throw new Error(`docs/agents/roles/${stage}.md not found under ${root}`);
  const work = join(root, '.work');
  const real = existsSync(work) ? realpathSync(work) : null;
  const reportPath = join(work, 'reports', `${id}.${stage}.json`);
  mkdirSync(join(work, 'reports'), { recursive: true });
  rmSync(reportPath, { force: true }); // a report left by an earlier run must not pass for this one
  const before = snapshot(root);
  const started = now();
  const run = await exec(bin, claudeArgs({ stage, prompt: promptFor(id, stage, note), budget, model, addDir: real && real !== work ? real : null }), { cwd: root });
  const seconds = Math.round((now() - started) / 1000);
  const j = parseClaudeJson(run.stdout);

  let report = readReport(root, id, stage);
  if (!report) {
    report = lastJsonObject(j?.result);
    if (report) writeFileSync(reportPath, `${JSON.stringify(report)}\n`); // the agent returned its report without writing it
  }
  if (report && typeof report.note === 'string' && report.note.length > 200) {
    report = { ...report, note: `${report.note.slice(0, 197)}...` }; // the note is for a person: cut it, do not fail a stage over it
    writeFileSync(reportPath, `${JSON.stringify(report)}\n`);
  }
  const blocked = (text) => ({ id, stage, status: 'blocked', note: text.slice(0, 200) });
  let outcome;
  if (limitHit(j, run.stderr)) outcome = { ...blocked('usage limit reached'), status: 'limit' };
  else if (!report) outcome = blocked(`no report (${j?.subtype ?? `exit ${run.status}`})${j?.result ? `: ${String(j.result).replace(/\s+/g, ' ').slice(0, 120)}` : ''}`);
  else {
    const problems = validateReport(report, id, stage);
    const stray = violations(before, snapshot(root), id, stage, siblings);
    if (problems.length) outcome = blocked(`invalid report: ${problems[0]}`);
    else if (stray.length) outcome = blocked(`wrote outside the card: ${stray.slice(0, 3).join(', ')}${stray.length > 3 ? ` (+${stray.length - 3})` : ''}`);
    else outcome = { id, stage, status: report.status, note: String(report.note ?? '').slice(0, 200) };
  }
  // A stage that is not done leaves a blocked report on disk: next.mjs then shows it as not done, and a person sees why.
  if (outcome.status !== 'done' && (!report || report.status !== 'blocked' || outcome.note !== String(report.note ?? '').slice(0, 200))) {
    if (report) writeFileSync(join(work, 'reports', `${id}.${stage}.agent.json`), `${JSON.stringify(report)}\n`); // keep what the agent wrote (the verifier's verdicts)
    writeFileSync(reportPath, `${JSON.stringify({ id, stage, status: 'blocked', note: outcome.note, files: [] })}\n`);
  }
  if (outcome.status === 'done' && STAGES.includes(stage)) record(root, id, stage, now());
  const usage = usageLine({ id, stage, status: outcome.status, j, seconds, now: now() });
  appendFileSync(join(work, 'usage.jsonl'), `${JSON.stringify(usage)}\n`);
  return { ...outcome, costUsd: usage.costUsd, turns: usage.turns, seconds };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const [id, stage] = args;
  cli('run-stage', () => {
    if (!id || !stage) throw new Error(`usage: node scripts/agent/run-stage.mjs <card-id> <${RUN_STAGES.join('|')}> [--budget 4] [--model sonnet] [--note "..."]`);
    const budget = option(args, '--budget');
    // --siblings a,b: the other cards that run at the same time in this worktree (run-batch passes them itself)
    const siblings = (option(args, '--siblings', '') ?? '').split(',').filter(Boolean);
    runStage({ id, stage, budget: budget === undefined ? undefined : Number(budget), model: option(args, '--model'), note: option(args, '--note', ''), siblings })
      .then((r) => {
        console.log(`${r.stage} ${r.id}: ${r.status}, $${r.costUsd}, ${r.turns} turns, ${r.seconds}s${r.note ? `: ${r.note}` : ''}`);
        process.exitCode = r.status === 'done' ? 0 : r.status === 'limit' ? 3 : 1;
      })
      .catch((e) => {
        console.error(`run-stage: ${e.message}`);
        process.exitCode = 2;
      });
  });
}
