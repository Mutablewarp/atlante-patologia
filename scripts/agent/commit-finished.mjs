#!/usr/bin/env node
/** Commit the finished cards, one commit each (docs/agents/CONTRACTS.md §5):
 *   AGENT_COAUTHOR="Co-Authored-By: Name <mail>" node scripts/agent/commit-finished.mjs [--batch W02]
 * Finished = six stages done and card:check passes. A commit holds exactly the card's own files, staged and committed by
 * name (never `git add -A`); a card that fails is skipped with a one-line reason and left unstaged. */
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { cli, finished, manifestRows, option, ROOT } from './record.mjs';

const IMAGES = 'src/content/images';
const clip = (s, n = 200) => String(s).replace(/\s+/g, ' ').trim().slice(0, n);

/** The paths of a card that exist, relative to the root: entity folder, ledger, image yaml, the image files they name. */
export function cardFiles(root, id) {
  const yamls = (existsSync(join(root, IMAGES)) ? readdirSync(join(root, IMAGES)) : []).filter((f) => new RegExp(`^${id}-[a-z]+-[0-9]+\\.yaml$`).test(f)).sort();
  const files = yamls.map((f) => parse(readFileSync(join(root, IMAGES, f), 'utf8'))?.file).filter(Boolean);
  const paths = [`src/content/entities/${id}`, `docs/ledger/${id}.yaml`, ...yamls.map((f) => `${IMAGES}/${f}`), ...files.map((f) => `src/assets/images/${f}`)];
  return paths.filter((p) => existsSync(join(root, p)));
}

/** card:check as a subprocess, as its contract says (JSON on stdout, exit 0 when ok): { ok, problems, more }. */
export const cardCheck = (root) => (id) => {
  const r = spawnSync(process.execPath, [join(root, 'scripts/agent/card-check.mjs'), id], { cwd: root, encoding: 'utf8', maxBuffer: 1 << 24 });
  try {
    const out = JSON.parse(r.stdout);
    return { ...out, ok: r.status === 0 && out.ok === true };
  } catch {
    return { ok: false, problems: [{ gate: 'run', message: `card:check printed no JSON: ${clip(r.stderr || r.stdout || r.error?.message, 120)}` }] };
  }
};

const checkReason = ({ problems = [], more = 0 }) =>
  `card:check failed${problems[0] ? `: [${problems[0].gate}] ${clip(problems[0].message, 140)}` : ''}${problems.length + more > 1 ? ` (+${problems.length + more - 1} more)` : ''}`;

export function commitFinished({ root, rows, check, env = process.env }) {
  const out = { committed: [], skipped: [], unchanged: [], unfinished: 0 };
  const trailer = env.AGENT_COAUTHOR?.replace(/^(?!co-authored-by:|$)/i, 'Co-Authored-By: '); // the value may omit the key
  // GIT_CEILING_DIRECTORIES: git never looks for a repository above the root it is given.
  const git = (...args) => spawnSync('git', ['-C', root, ...args], { encoding: 'utf8', env: { ...env, GIT_CEILING_DIRECTORIES: dirname(root) } });
  const must = (...args) => {
    const r = git(...args);
    if (r.status !== 0) throw new Error(`git ${args[0]} failed: ${r.stderr || r.stdout}`);
  };
  for (const { id, kind, priority } of rows) {
    const verdict = finished(root, id) ? check(id) : null;
    const paths = verdict?.ok ? cardFiles(root, id) : [];
    if (!verdict) out.unfinished++;
    else if (!verdict.ok) out.skipped.push({ id, reason: clip(checkReason(verdict)) });
    else if (!paths.length) out.skipped.push({ id, reason: 'no file of the card exists' }); // an empty pathspec would take the whole index
    else {
      try {
        must('add', '--', ...paths);
        if (git('diff', '--cached', '--quiet', '--', ...paths).status === 0) out.unchanged.push(id); // committed before
        else {
          must('commit', '-q', ...[`feat(${id}): add the card (${kind}, ${priority})`, trailer].filter(Boolean).flatMap((m) => ['-m', m]), '--', ...paths);
          out.committed.push(id);
        }
      } catch (e) {
        git('reset', '-q', '--', ...paths); // unstage this card only
        out.skipped.push({ id, reason: clip(e.message) });
      }
    }
  }
  return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  cli('commit-finished', () => {
    const r = commitFinished({ root: ROOT, rows: manifestRows(ROOT, option(process.argv.slice(2), '--batch')), check: cardCheck(ROOT) });
    console.log(`commit-finished: ${r.committed.length} committed${r.committed.length ? ` (${r.committed.join(', ')})` : ''}, ${r.skipped.length} skipped, ${r.unchanged.length} already committed, ${r.unfinished} unfinished`);
    for (const s of r.skipped) console.log(`  skip ${s.id}: ${s.reason}`);
  });
}
