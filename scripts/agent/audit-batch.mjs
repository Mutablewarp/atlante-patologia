#!/usr/bin/env node
/**
 * Checks of a finished sub-batch before it is committed (docs/agents/CONTRACTS.md §7):
 *   node scripts/agent/audit-batch.mjs --batch W03 [--audit 4] [--only a,b] [--concurrency 3]
 * For every card of the batch that has an en.md: `card:check --stage all`, the ledger rows now against the author's count, and a
 * read-only lean agent that checks the must-cover items and the questions (coverage). For `--audit` cards, spread over the batch,
 * a second read-only agent audits 15 claims against the cited pages: support, Italian, close paraphrase, medical error.
 * Reports: .work/reports/<id>.coverage.json, <id>.audit.json and <batch>.audit-summary.json. Prints one line per card and the
 * totals. Edits no card. Exit code: 0 clean, 1 something to look at, 3 usage limit reached.
 */
import { spawnSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cli, manifestRows, option, readReport, ROOT } from './record.mjs';
import { claudeArgs, execute, lastJsonObject, limitHit, parseClaudeJson, usageLine } from './run-stage.mjs';

const HEAD = 'of the Atlante di Patologia (a bilingual pathology study atlas). Card id: ID. Work in this repository root. Do not edit anything.';
const FILES = 'src/content/entities/ID/en.md and it.md (every factual sentence ends with a marker <!--c:ID-cNNN-->), docs/ledger/ID.yaml (one row per claimId: statement, sourceRef with printed pages)';
export const PROMPTS = {
  audit: [
    `You are an independent auditor of one card ${HEAD}`,
    `Files: ${FILES}, .work/packets/ID/source.txt (the textbook pages; each block starts with a line [p. N], N is the printed page), and if present .work/packets/ID/second-sources.md.`,
    'Audit exactly 15 claims, evenly spread over the ledger in file order: with N rows take every (N div 15)-th row from the first (every row when N is 15 or less). For each one read the ledger row, the English sentence with that marker, the Italian sentence with that marker, and the cited pages (or the second-source note).',
    'Judge each: (a) en_support: supported, partly, unsupported or contradicted by the cited pages; (b) it_faithful: yes or no (the Italian says the same thing, with correct medical terms); (c) close_paraphrase: yes if the English sentence keeps three or more content points of one source sentence in the same order with word-for-word synonym swaps, or reuses a distinctive list of three or more items, or copies a run of about six words or more; (d) medical_error: yes if the English sentence is wrong by standard medical knowledge even when it follows the page; (e) a short note when anything is not "supported, yes, no, no".',
    'An error is: en_support unsupported or contradicted, or it_faithful no with a change of meaning, or medical_error yes. Partly counts as half an error. Close paraphrase is counted separately.',
    'Final message: only this JSON: {"id":"ID","audited":15,"errors":0,"half_errors":0,"close_paraphrases":0,"verdicts":[{"claim":"ID-cNNN","en_support":"supported","it_faithful":"yes","close_paraphrase":"no","medical_error":"no","note":""}]}',
  ].join('\n'),
  coverage: [
    `You check one card ${HEAD}`,
    `Read .work/packets/ID/row.json (the list mustCover), ${FILES}, and src/content/entities/ID/meta.yaml (quickChecks, examQuestions, selfExplain and any field that names claim ids).`,
    '1. For each mustCover item: does the English card cover it? An item with several parts in brackets is covered only when each part is there. Give up to 4 claim ids that cover it, or say what is missing. A part the packet pages do not contain, and that docs or the card log as not found in the reference, counts as missing with the note "not in the packet".',
    '2. List every claim id that meta.yaml names and that has no row in the ledger or no marker in en.md.',
    '3. List every question or quick check of meta.yaml whose answer rests on a fact the card does not state (its first words, and the fact).',
    'Final message: only this JSON: {"id":"ID","mustCover":[{"item":"...","covered":true,"claims":["ID-c001"],"missing":""}],"danglingClaims":[],"orphanQuestions":[{"question":"...","fact":"..."}]}',
  ].join('\n'),
};

/** `n` items evenly spread over the list, the first included. */
export const spread = (list, n) => (n >= list.length ? [...list] : Array.from({ length: Math.max(0, n) }, (_, i) => list[Math.floor((i * list.length) / n)]));

/** `card:check --stage all` of one card: 'ok', or the end of what it printed. */
export function checkCard(root, id) {
  const r = spawnSync('npm', ['run', '-s', 'card:check', '--', id, '--stage', 'all'], { cwd: root, encoding: 'utf8' });
  return r.status === 0 ? 'ok' : `FAIL ${`${r.stdout}${r.stderr}`.trim().split('\n').slice(-3).join(' | ').slice(0, 300)}`;
}

/** What needs a look in one card's results; empty when clean. */
export function flags(card) {
  return [
    card.check !== 'ok' && 'card:check fails',
    card.coverage === null && 'no coverage report',
    card.coverage?.mustCover?.some((m) => !m.covered) && 'must-cover item missing',
    card.coverage?.danglingClaims?.length && 'a question names a missing claim',
    card.coverage?.orphanQuestions?.length && 'a question rests on a fact the card lacks',
    card.audit === null && 'no audit report',
    card.audit && card.audit.errors + card.audit.half_errors / 2 > 0 && 'audit found an error',
  ].filter(Boolean);
}

/** Runs the checks. `exec` and `check` are replaceable (tests). Resolves { cards, totals, stop, costUsd }. */
export async function auditBatch({ root = ROOT, ids, audit = 4, concurrency = 3, exec = execute, check = checkCard, now = () => new Date(), bin = process.env.CLAUDE_BIN || 'claude' }) {
  const work = join(root, '.work');
  mkdirSync(join(work, 'reports'), { recursive: true });
  const real = existsSync(work) ? realpathSync(work) : null;
  const audited = new Set(spread(ids, audit));
  const cards = new Map(ids.map((id) => [id, { id, check: check(root, id), claimsAuthor: readReport(root, id, 'author')?.claims ?? null, claimsNow: (readFileSync(join(root, 'docs/ledger', `${id}.yaml`), 'utf8').match(/claimId:/g) ?? []).length }]));
  let stop = null;
  let costUsd = 0;
  const jobs = ids.flatMap((id) => [['coverage', id], ...(audited.has(id) ? [['audit', id]] : [])]);
  const worker = async () => {
    while (jobs.length && !stop) {
      const [kind, id] = jobs.shift();
      const started = now();
      const run = await exec(bin, claudeArgs({ stage: 'auditor', prompt: PROMPTS[kind].replace(/\bID\b/g, id), addDir: real && real !== work ? real : null }), { cwd: root });
      const j = parseClaudeJson(run.stdout);
      if (limitHit(j, run.stderr)) stop = 'limit';
      const report = stop ? null : lastJsonObject(j?.result);
      const ok = report && report.id === id && (kind === 'audit' ? Array.isArray(report.verdicts) : Array.isArray(report.mustCover));
      cards.get(id)[kind] = ok ? report : null;
      if (ok) writeFileSync(join(work, 'reports', `${id}.${kind}.json`), `${JSON.stringify(report)}\n`);
      const usage = usageLine({ id, stage: kind, status: ok ? 'done' : stop ? 'limit' : 'blocked', j, seconds: Math.round((now() - started) / 1000), now: now() });
      costUsd += usage.costUsd;
      appendFileSync(join(work, 'usage.jsonl'), `${JSON.stringify(usage)}\n`);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, concurrency) }, worker));
  const list = [...cards.values()].map((c) => ({ ...c, coverage: c.coverage ?? null, ...(audited.has(c.id) ? { audit: c.audit ?? null } : {}) }));
  const audits = list.map((c) => c.audit).filter(Boolean);
  const sum = (key) => audits.reduce((n, a) => n + (Number(a[key]) || 0), 0);
  const totals = { cards: list.length, audited: sum('audited'), errors: sum('errors'), halfErrors: sum('half_errors'), closeParaphrases: sum('close_paraphrases'), flagged: list.filter((c) => flags(c).length).map((c) => c.id) };
  return { cards: list, totals, stop, costUsd: Number(costUsd.toFixed(4)) };
}

/** One line per card for a person. */
export function line(c) {
  const missing = (c.coverage?.mustCover ?? []).filter((m) => !m.covered).map((m) => `${m.item} [${m.missing}]`);
  const flagged = (c.audit?.verdicts ?? []).filter((v) => v.close_paraphrase === 'yes' || v.en_support !== 'supported' || v.it_faithful !== 'yes' || v.medical_error === 'yes');
  return [
    `${c.id}: check ${c.check}; claims ${c.claimsAuthor ?? '?'} -> ${c.claimsNow}`,
    c.coverage === null ? 'coverage: no report' : `must-cover missing ${missing.length}${missing.length ? ` (${missing.join('; ').slice(0, 300)})` : ''}, dangling ${c.coverage.danglingClaims?.length ?? 0}, orphan questions ${c.coverage.orphanQuestions?.length ?? 0}`,
    c.audit === undefined ? null : c.audit === null ? 'audit: no report' : `audit ${c.audit.audited}: errors ${c.audit.errors}, half ${c.audit.half_errors}, close ${c.audit.close_paraphrases}${flagged.map((v) => `\n    ${v.claim} ${v.en_support}/it:${v.it_faithful}/close:${v.close_paraphrase}/med:${v.medical_error} ${String(v.note ?? '').slice(0, 160)}`).join('')}`,
  ].filter(Boolean).join('; ');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  cli('audit-batch', () => {
    const batch = option(args, '--batch');
    const only = option(args, '--only')?.split(',').filter(Boolean);
    const audit = Number(option(args, '--audit', '4'));
    const concurrency = Number(option(args, '--concurrency', '3'));
    if (!batch || !Number.isInteger(audit) || audit < 0 || !Number.isInteger(concurrency) || concurrency < 1) throw new Error('usage: node scripts/agent/audit-batch.mjs --batch W03 [--audit 4] [--only a,b] [--concurrency 3]');
    const ids = (only ?? manifestRows(ROOT, batch).map((r) => r.id)).filter((id) => existsSync(join(ROOT, 'src/content/entities', id, 'en.md')) && existsSync(join(ROOT, 'docs/ledger', `${id}.yaml`)));
    if (!ids.length) throw new Error(`no card of ${batch} has an en.md and a ledger yet`);
    auditBatch({ ids, audit, concurrency }).then(({ cards, totals, stop, costUsd }) => {
      for (const c of cards) console.log(line(c));
      console.log(`audit-batch ${batch}: ${totals.cards} card(s); audited ${totals.audited} claims: ${totals.errors} errors, ${totals.halfErrors} half, ${totals.closeParaphrases} close paraphrases; flagged: ${totals.flagged.join(', ') || 'none'}; $${costUsd}${stop ? `; stopped: ${stop}` : ''}`);
      writeFileSync(join(ROOT, '.work/reports', `${batch}.audit-summary.json`), `${JSON.stringify({ batch, totals, costUsd, stop, cards }, null, 1)}\n`);
      process.exitCode = stop === 'limit' ? 3 : totals.flagged.length ? 1 : 0;
    });
  });
}
