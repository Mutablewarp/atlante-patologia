#!/usr/bin/env node
// Containment guard (COMPLIANCE_PLAN §1.1). Plain Node ESM, no dependencies.
//
//   node scripts/guard.mjs --staged   files staged for commit (pre-commit hook)
//   node scripts/guard.mjs --tree     files tracked by git (CI); outside a git
//                                     repo, walks the working tree instead
//
// Fails when: a path is under reference/, .work/ or private/; a .pdf/.epub/
// .docx/.mobi/.azw3 file is larger than 100 KB; any file is larger than 10 MB.
import { execFileSync } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const FORBIDDEN_DIRS = ['reference', '.work', 'private'];
export const BOOK_EXT = /\.(pdf|epub|docx|mobi|azw3)$/i;
export const BOOK_MAX = 100 * 1024;
export const FILE_MAX = 10 * 1024 * 1024;
const WALK_SKIP = new Set(['node_modules', 'dist', '.git', '.astro', 'test-results', 'playwright-report', 'reports']);

/** Pure check: [{ path, size }] → list of human-readable violations. */
export function checkFiles(files) {
  const problems = [];
  for (const { path, size } of files) {
    const p = path.split(sep).join('/').replace(/^\.\//, '');
    const top = p.split('/')[0];
    if (FORBIDDEN_DIRS.includes(top))
      problems.push(`${p}: files under ${top}/ must never be committed (copyrighted or owner-private material)`);
    if (BOOK_EXT.test(p) && size > BOOK_MAX)
      problems.push(`${p}: ${fmt(size)} document exceeds the ${fmt(BOOK_MAX)} limit for .pdf/.epub/.docx/.mobi/.azw3 files`);
    if (size > FILE_MAX) problems.push(`${p}: ${fmt(size)} exceeds the ${fmt(FILE_MAX)} per-file limit`);
  }
  return problems;
}

function fmt(bytes) {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;
}

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
}

function isGitRepo() {
  try {
    return git(['rev-parse', '--is-inside-work-tree']).trim() === 'true';
  } catch {
    return false;
  }
}

/** Staged files with the size of the staged blob (not the working copy). */
function stagedFiles() {
  const names = git(['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z']).split('\0').filter(Boolean);
  return names.map((path) => ({ path, size: Number(git(['cat-file', '-s', `:${path}`]).trim()) }));
}

function trackedFiles() {
  return git(['ls-files', '-z'])
    .split('\0')
    .filter(Boolean)
    .map((path) => {
      try {
        return { path, size: statSync(path).size };
      } catch {
        return { path, size: 0 }; // deleted in the working tree but still tracked
      }
    });
}

/** Fallback without git: everything except build output and ignored private dirs' contents is listed. */
function walk(root) {
  const out = [];
  const visit = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (WALK_SKIP.has(entry.name)) continue;
      const full = join(dir, entry.name);
      const rel = relative(root, full);
      // Gitignored containment dirs are expected locally; only report them inside git.
      if (dir === root && FORBIDDEN_DIRS.includes(entry.name)) continue;
      if (entry.isDirectory()) visit(full);
      else if (entry.isFile()) out.push({ path: rel, size: statSync(full).size });
    }
  };
  visit(root);
  return out;
}

function main(argv) {
  const mode = argv.includes('--staged') ? 'staged' : argv.includes('--tree') ? 'tree' : null;
  if (!mode) {
    console.error('usage: node scripts/guard.mjs --staged | --tree');
    return 2;
  }
  let files;
  if (isGitRepo()) files = mode === 'staged' ? stagedFiles() : trackedFiles();
  else if (mode === 'tree') files = walk(process.cwd());
  else {
    console.error('guard: --staged needs a git repository');
    return 2;
  }
  const problems = checkFiles(files);
  if (problems.length) {
    console.error(`guard: BLOCKED — ${problems.length} problem(s):`);
    for (const p of problems) console.error(`  ✗ ${p}`);
    console.error('Remove these files from the commit (git rm --cached <path>) and keep them out of the repository.');
    return 1;
  }
  console.log(`guard: ok (${files.length} ${mode === 'staged' ? 'staged' : 'checked'} files)`);
  return 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) process.exit(main(process.argv.slice(2)));
