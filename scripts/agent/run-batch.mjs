#!/usr/bin/env node
/**
 * One sub-batch of cards on lean agents (docs/agents/CONTRACTS.md §7):
 *   node scripts/agent/run-batch.mjs --batch W02 [--max 8] [--concurrency 3] [--until scout] [--only a,b] [--budget 40] [--dry-run]
 * Takes the cards of next.mjs and runs run-stage.mjs for each stage from its `from` to `--until`, `--concurrency` cards at a time.
 * A blocked card stops and the others go on; a usage limit, or `--budget` dollars spent (API prices), stops the launching of new
 * stages. Running it again resumes: next.mjs starts each card at the first stage without a done report. It commits nothing:
 * afterwards run `npm run agent:commit` and `npm run agent:finalize`. Writes .work/last-batch.json. Exit code: 0 all done,
 * 1 a card blocked, 3 usage limit.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { next } from './next.mjs';
import { cli, option, ROOT, STAGES } from './record.mjs';
import { runStage } from './run-stage.mjs';

const money = (n) => Number(n.toFixed(4));

/**
 * Runs `queue` ([{ id, from }]) stage by stage. `run({ id, stage })` resolves { status, costUsd, ... } (tests replace it);
 * `log(result)` sees each finished stage. Resolves { results, spent, stop: null | 'limit' | 'budget' }.
 */
export async function runBatch({ queue, concurrency = 3, until = 'scout', budgetUsd = Infinity, distance = true, run, log = () => {} }) {
  const results = [];
  let spent = 0;
  let stop = null;
  /** Runs one stage; false when the card must stop (blocked, limit, budget or a stop elsewhere). */
  const step = async (id, stage) => {
    if (stop) return false;
    if (spent >= budgetUsd) {
      stop = 'budget';
      return false;
    }
    const r = await run({ id, stage });
    spent += r.costUsd ?? 0;
    results.push(r);
    log(r);
    if (r.status === 'limit') stop = 'limit';
    return r.status === 'done'; // a blocked card stops; the others go on
  };
  const card = async ({ id, from }) => {
    for (const stage of STAGES.slice(STAGES.indexOf(from), STAGES.indexOf(until) + 1)) {
      if (!(await step(id, stage))) return;
      if (stage === 'author' && distance && !(await step(id, 'distance'))) return; // restructure the sentences before the translation is made from them
    }
  };
  const pending = [...queue];
  const worker = async () => {
    while (pending.length && !stop) await card(pending.shift());
  };
  await Promise.all(Array.from({ length: Math.min(Math.max(1, concurrency), pending.length) }, worker));
  return { results, spent: money(spent), stop };
}

/** One line per finished stage. */
export const line = (r) => `${r.stage} ${r.id}: ${r.status}, $${r.costUsd ?? 0}, ${r.turns ?? 0} turns, ${r.seconds ?? 0}s${r.note ? `: ${r.note}` : ''}`;

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  cli('run-batch', () => {
    const batch = option(args, '--batch');
    const max = Number(option(args, '--max', '8'));
    const concurrency = Number(option(args, '--concurrency', '3'));
    const until = option(args, '--until', 'scout');
    const budgetUsd = Number(option(args, '--budget', '40'));
    const only = option(args, '--only')?.split(',').filter(Boolean);
    if (!batch || !Number.isInteger(max) || max < 1 || !Number.isInteger(concurrency) || concurrency < 1 || !STAGES.includes(until) || !(budgetUsd > 0))
      throw new Error(`usage: node scripts/agent/run-batch.mjs --batch W02 [--max 8] [--concurrency 3] [--until ${STAGES.join('|')}] [--only a,b] [--budget 40] [--dry-run]`);
    const taken = next(ROOT, { batch, max: only ? 1000 : max });
    for (const p of taken.problems) console.error(`run-batch: ${p}`);
    const queue = (only ? taken.cards.filter((c) => only.includes(c.id)).slice(0, max) : taken.cards).filter((c) => STAGES.indexOf(c.from) <= STAGES.indexOf(until));
    console.log(`run-batch ${batch}: ${queue.length} card(s) [${queue.map((c) => `${c.id} from ${c.from}`).join(', ')}], until ${until}, concurrency ${concurrency}, budget $${budgetUsd}`);
    if (args.includes('--dry-run') || !queue.length) return;
    runBatch({ queue, concurrency, until, budgetUsd, distance: !args.includes('--no-distance'), run: ({ id, stage }) => runStage({ root: ROOT, id, stage, siblings: queue.map((c) => c.id) }), log: (r) => console.log(line(r)) }).then(({ results, spent, stop }) => {
      const blocked = results.filter((r) => r.status !== 'done');
      const done = queue.map((c) => c.id).filter((id) => !blocked.some((r) => r.id === id));
      console.log(`run-batch ${batch}: ${results.length} stage(s) run, $${spent}${stop ? `, stopped: ${stop}` : ''}; ${blocked.length ? `blocked: ${blocked.map((r) => `${r.stage}:${r.id}`).join(', ')}` : 'no card blocked'}`);
      mkdirSync(join(ROOT, '.work'), { recursive: true });
      writeFileSync(join(ROOT, '.work/last-batch.json'), `${JSON.stringify({ batch, until, spent, stop, results, cardsWithoutBlock: done }, null, 1)}\n`);
      process.exitCode = stop === 'limit' ? 3 : blocked.length ? 1 : 0;
    });
  });
}
