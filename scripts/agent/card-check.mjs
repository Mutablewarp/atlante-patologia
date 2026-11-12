#!/usr/bin/env node
/**
 * The check of one card (docs/agents/CONTRACTS.md §4).
 *   npm run card:check -- <id> [--stage author|translator|verifier|fixer|questions|scout|all]
 * Prints a JSON object of at most 30 lines and exits 0 when `ok`. Gates: the content tests of the card (tests/content-one), no-verbatim,
 * `translatedFrom`, claim markers against the ledger, the word cap of the packet. `--stage S` checks the card as agent S left it: before
 * `translator` there is no it.md and before `scout` there are no images, so the gates on those are skipped.
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
export const STAGES = ['author', 'translator', 'verifier', 'fixer', 'questions', 'scout'];
const SHOWN = 15;
const FRONT = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

const cut = (s, n = 160) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
const problem = (gate, where, message) => ({ gate, where, message: cut(message) });
const ls = (dir) => (existsSync(dir) ? readdirSync(dir) : []);
// The reason of a command that failed without a result: its first line naming an error, else its last line.
const why = (text) => text.split('\n').find((l) => /error/i.test(l)) ?? text.trim().split('\n').at(-1) ?? '';
// vitest prints the strings of its diff with " and \ escaped.
const unquote = (s) => s.replace(/\\(["\\])/g, '$1');

/**
 * Problems in the text output of `vitest run tests/content-one` (a non-zero status). The JSON reporter cannot be used: the test
 * "passes every gate" fails with `expected [ …(3) ] to deeply equal []`, and only the default reporter prints the list in its diff.
 * Each `[gate] file: message` line of that diff is one problem; any other failing test is one problem with its first message line.
 */
export function parseContentOutput({ status, output }) {
  if (status === 0) return [];
  const blocks = output.replace(/\x1b\[[0-9;]*m/g, '').split(/^ FAIL +/m).slice(1);
  if (!blocks.length) return [problem('content', 'tests/content-one', `vitest failed: ${why(output)}`)];
  return blocks.flatMap((block) => {
    const [title, first = ''] = block.split('\n');
    const lines = [...block.matchAll(/^\+ {3}"(\[[a-z]+\] .*)",?$/gm)].map((m) => unquote(m[1]));
    if (!lines.length) return [problem('content', 'tests/content-one', `${title.split(' > ').at(-1)}: ${first.replace(/^\w*Error: /, '')}`)];
    return lines.map((line) => {
      const m = line.match(/^\[([a-z]+)\] (\S+?): (.*)$/);
      return m ? problem(m[1], m[2], m[3]) : problem('content', 'tests/content-one', line);
    });
  });
}

/** Problems in the output of scripts/no-verbatim.mjs --where: one `FAIL <file>: <counts>` line per file, then `  lines: <numbers>` (it never prints reference text). */
export function parseVerbatimOutput({ status, output }) {
  const fails = [...output.matchAll(/^FAIL (\S+): (.*)(?:\n {2}lines: (.*))?$/gm)].map((m) => problem('verbatim', m[1], m[3] ? `${m[2]}; lines ${m[3]}` : m[2]));
  if (status === 0) return [];
  return fails.length ? fails : [problem('verbatim', 'scripts/no-verbatim.mjs', `failed: ${why(output)}`)];
}

/** Words of a card: runs of letters and digits (one per hyphenated or apostrophe word), outside frontmatter, comments and tags. */
export function countWords(md) {
  const body = md.replace(FRONT, '').replace(/<!--[\s\S]*?-->/g, ' ').replace(/<[^>]+>/g, ' ');
  return (body.match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu) ?? []).length;
}

const markers = (md) => new Set([...md.matchAll(/<!--\s*c:([^\s>]+?)\s*-->/g)].map((m) => m[1]));
const gap = (a, b) => [...a].filter((x) => !b.has(x));
const ledgerIds = (text) => { try { return parse(text).claims.map((c) => c.claimId); } catch { return null; } };
const show = (ids, id) => {
  const names = ids.map((x) => (x.startsWith(`${id}-`) ? x.slice(id.length + 1) : x));
  return names.slice(0, 5).join(', ') + (names.length > 5 ? ` (+${names.length - 5})` : '');
};

/** Gate 4: the markers of en.md, those of it.md (when there is one) and the claim ids of the ledger are the same list. */
function markerProblems(id, dir, en, it, rows) {
  const inEn = markers(en);
  const inIt = it === null ? null : markers(it);
  const ids = new Set(rows);
  return [
    [`${dir}/it.md`, 'markers only in en.md', inIt && gap(inEn, inIt)],
    [`${dir}/en.md`, 'markers only in it.md', inIt && gap(inIt, inEn)],
    [`${dir}/en.md`, 'markers without a ledger row', gap(inEn, ids)],
    [`docs/ledger/${id}.yaml`, 'ledger rows without a marker in en.md', gap(ids, inEn)],
  ]
    .filter(([, , missing]) => missing?.length)
    .map(([where, what, missing]) => problem('claims', where, `${what}: ${show(missing, id)}`));
}

const run = (root, args, env = {}) => {
  const r = spawnSync(process.execPath, args, { cwd: root, encoding: 'utf8', maxBuffer: 1 << 26, env: { ...process.env, ...env } });
  return { status: r.status ?? 1, output: `${r.stdout ?? ''}${r.stderr ?? ''}${r.error?.message ?? ''}` };
};

/** The check of card `id` under `root`. `runContent(id)` and `runVerbatim(paths)` return `{ status, output }` of the two commands; tests replace them. */
export function checkCard(id, {
  root = ROOT,
  stage = 'all',
  runContent = (x) => run(root, ['node_modules/vitest/vitest.mjs', 'run', '--project', 'unit', 'tests/content-one', '--reporter=default'], { ENTITY: x, NO_COLOR: '1' }),
  runVerbatim = (paths) => run(root, ['scripts/no-verbatim.mjs', '--where', ...paths]),
} = {}) {
  const at = stage === 'all' ? Infinity : STAGES.indexOf(stage);
  const hasIt = at >= STAGES.indexOf('translator');
  const hasImages = at >= STAGES.indexOf('scout');
  const dir = `src/content/entities/${id}`;
  const ledgerPath = `docs/ledger/${id}.yaml`;
  const read = (path) => (existsSync(join(root, path)) ? readFileSync(join(root, path), 'utf8') : null);
  const en = read(`${dir}/en.md`);
  const it = hasIt ? read(`${dir}/it.md`) : null;
  const skipped = [];

  // 1. the content tests; before translator the parity gate cannot see it.md
  const problems = parseContentOutput(runContent(id)).filter((p) => hasIt || !p.where.endsWith('/it.md'));
  const add = (gate, where, message) => problems.push(problem(gate, where, message));
  if (!hasIt) skipped.push('it.md gates (before translator)');
  if (!hasImages) skipped.push('image files (before scout)');

  // 2. no-verbatim on the card's files
  if (ls(join(root, '.work')).some((f) => f.endsWith('.txt'))) {
    const images = hasImages ? ls(join(root, 'src/content/images')).filter((f) => f.startsWith(`${id}-`) && f.endsWith('.yaml')).map((f) => `src/content/images/${f}`) : [];
    problems.push(...parseVerbatimOutput(runVerbatim([dir, ledgerPath, ...images].filter((p) => existsSync(join(root, p))))));
  } else skipped.push('verbatim (no .work/*.txt)');

  // 3. translatedFrom is the sha256 of en.md
  if (hasIt && en !== null) {
    const got = it?.match(FRONT)?.[1].match(/^translatedFrom:\s*["']?([0-9a-f]+)["']?\s*$/m)?.[1];
    const want = createHash('sha256').update(en).digest('hex');
    if (it === null) add('translation', `${dir}/it.md`, 'it.md is missing');
    else if (got !== want) add('translation', `${dir}/it.md`, `translatedFrom ${got ?? 'missing'}; expected ${want}`);
  }

  // 4. claim markers against the ledger
  if (en !== null) {
    const text = read(ledgerPath);
    const rows = text === null ? null : ledgerIds(text);
    if (text === null) add('claims', ledgerPath, 'ledger is missing');
    else if (rows === null) add('claims', ledgerPath, 'cannot read the claims list');
    else problems.push(...markerProblems(id, dir, en, it, rows));
  }

  // 5. the word cap of the packet, when there is one
  const packet = join(root, '.work/packets', id, 'row.json');
  const cap = existsSync(packet) ? (JSON.parse(readFileSync(packet, 'utf8')).depth?.maxWordsEn ?? null) : null;
  const words = { en: en === null ? null : countWords(en), it: it === null ? null : countWords(it), cap };
  if (cap !== null && words.en > cap) add('words', `${dir}/en.md`, `${words.en} words; the cap for this card is ${cap}`);

  return { id, ok: problems.length === 0, words, problems: problems.slice(0, SHOWN), more: Math.max(0, problems.length - SHOWN), skipped };
}

/** The result as JSON with one problem per line: 24 lines at most. */
export function format({ id, ok, words, problems, more, skipped }) {
  const rows = problems.map((p) => `  ${JSON.stringify(p)}`);
  const list = rows.length ? `\n${rows.join(',\n')}\n ` : '';
  return `{\n "id": ${JSON.stringify(id)},\n "ok": ${ok},\n "words": ${JSON.stringify(words)},\n "problems": [${list}],\n "more": ${more},\n "skipped": ${JSON.stringify(skipped)}\n}`;
}

function main(args) {
  const [id] = args;
  const i = args.indexOf('--stage');
  const stage = i < 0 ? 'all' : args[i + 1];
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(id ?? '') || ![...STAGES, 'all'].includes(stage)) {
    console.error(`Usage: npm run card:check -- <id> [--stage ${[...STAGES, 'all'].join('|')}]`);
    process.exit(2);
  }
  const result = checkCard(id, { stage });
  console.log(format(result));
  process.exitCode = result.ok ? 0 : 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main(process.argv.slice(2));
