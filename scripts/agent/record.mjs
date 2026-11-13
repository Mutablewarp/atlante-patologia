#!/usr/bin/env node
/** Record one agent report (docs/agents/CONTRACTS.md §3):  node scripts/agent/record.mjs <card-id> <stage>
 * Checks .work/reports/<id>.<stage>.json and writes .work/state/<id>.json; also the helpers the other scripts here share. */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = fileURLToPath(new URL('../..', import.meta.url));
export const STAGES = ['author', 'translator', 'verifier', 'fixer', 'questions', 'scout'];
const VERDICTS = ['supported', 'partly-supported', 'unsupported', 'contradicted', 'close-paraphrase'];
const isString = (v) => typeof v === 'string';

export const option = (args, name, fallback) => (args.includes(name) ? (args[args.indexOf(name) + 1] ?? fallback) : fallback);

/** Runs a CLI body: an Error (usage, no manifest) becomes `name: message` on stderr and exit code 2. */
export const cli = (name, body) => { try { body(); } catch (e) { console.error(`${name}: ${e.message}`); process.exit(2); } };

/** The manifest rows of a batch (all rows without one); throws when there are none. */
export function manifestRows(root, batch) {
  const rows = JSON.parse(readFileSync(join(root, '.work/manifest.json'), 'utf8')).filter((r) => !batch || r.batch === batch);
  if (!rows.length) throw new Error(`no card in ${batch ? `batch ${batch}` : 'the manifest'}`);
  return rows;
}

const verdictProblems = (vs) =>
  !Array.isArray(vs) || !vs.length
    ? ['verdicts must be a non-empty list']
    : vs.flatMap((v, i) =>
        [
          !isString(v?.claim) && 'claim must be a claim id',
          !VERDICTS.includes(v?.verdict) && `verdict must be one of ${VERDICTS.join(', ')}`,
          !isString(v?.locator) && 'locator must be a string',
          v?.fix !== undefined && (v.verdict === 'supported' || !v.fix || typeof v.fix !== 'object') && 'fix must be an object, and only on a verdict that is not "supported"',
        ].filter(Boolean).map((m) => `verdicts[${i}]: ${m}`),
      );

/** What is wrong with a report of `stage` for the card `id`; empty when it is valid. */
export function validateReport(r, id, stage) {
  if (!r || typeof r !== 'object' || Array.isArray(r)) return ['the report is not a JSON object'];
  return [
    r.id !== id && `id is ${JSON.stringify(r.id)}, expected "${id}"`,
    r.stage !== stage && `stage is ${JSON.stringify(r.stage)}, expected "${stage}"`,
    !['done', 'blocked'].includes(r.status) && `status ${JSON.stringify(r.status)} is not "done" or "blocked"`,
    r.note !== undefined && (!isString(r.note) || r.note.length > 200) && 'note must be a string of at most 200 characters',
    r.files !== undefined && !(Array.isArray(r.files) && r.files.every(isString)) && 'files must be a list of paths',
    ...(stage === 'verifier' && r.status === 'done' ? verdictProblems(r.verdicts) : []),
  ].filter(Boolean);
}

/** The parsed report of a stage, or null when there is none or it is not JSON. */
export function readReport(root, id, stage) {
  try { return JSON.parse(readFileSync(join(root, '.work/reports', `${id}.${stage}.json`), 'utf8')); } catch { return null; }
}

const isDone = (root, id, stage) => {
  const r = readReport(root, id, stage);
  return r?.status === 'done' && validateReport(r, id, stage).length === 0;
};
/** The first stage of a card without a done report; null when all six are done. */
export const stageFrom = (root, id) => STAGES.find((s) => !isDone(root, id, s)) ?? null;
export const finished = (root, id) => stageFrom(root, id) === null;

/** Check the report of one stage and write the card's state. */
export function record(root, id, stage, now = new Date()) {
  const fail = (...problems) => ({ ok: false, problems, state: null });
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(id) || !STAGES.includes(stage)) return fail(`"${id}" and "${stage}" are not a card id and one of ${STAGES.join(', ')}`);
  const report = readReport(root, id, stage);
  if (!report) return fail(`no report at .work/reports/${id}.${stage}.json (or it is not JSON)`);
  const problems = validateReport(report, id, stage);
  if (problems.length) return fail(...problems);
  const state = { id, stage, status: report.status, updated: now.toISOString() };
  mkdirSync(join(root, '.work/state'), { recursive: true });
  writeFileSync(join(root, '.work/state', `${id}.json`), `${JSON.stringify(state)}\n`);
  return { ok: true, problems: [], state };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [id, stage] = process.argv.slice(2);
  cli('record', () => {
    if (!id || !stage) throw new Error(`usage: node scripts/agent/record.mjs <card-id> <${STAGES.join('|')}>`);
    const { ok, problems, state } = record(ROOT, id, stage);
    if (ok) return console.log(`record ${id} ${stage}: ${state.status}`);
    console.error(`record ${id} ${stage}: ${problems.length} problem(s)\n  ${problems.slice(0, 10).join('\n  ')}`);
    process.exit(1);
  });
}
