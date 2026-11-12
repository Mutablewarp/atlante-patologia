// commit-finished.mjs and finalize-batch.mjs (docs/agents/CONTRACTS.md §5 and §6) on handwritten fixtures in temp dirs.
// Git runs only inside a throwaway repository created with `git init` in the temp dir, never in the real checkout: the
// environment passed to git has no GIT_* variable from the parent, no global or system config, and a ceiling directory
// above the temp dir, and the test checks that `git rev-parse --show-toplevel` is the temp dir before it does anything.
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cardCheck, cardFiles, commitFinished } from '../scripts/agent/commit-finished.mjs';
import { finalize, mergePlanned, mergeRows, mergeSources, renderSelfVerified, selfVerified } from '../scripts/agent/finalize-batch.mjs';
import { STAGES } from '../scripts/agent/record.mjs';
import { isSelfVerifier, SELF_VERIFIED } from '../src/lib/self-verified.ts';

vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 }); // dozens of git processes per test, on a machine that may be busy

let root = '';
beforeEach(() => {
  root = realpathSync(mkdtempSync(join(tmpdir(), 'agent-commit-')));
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

const put = (rel: string, text: string) => {
  mkdirSync(dirname(join(root, rel)), { recursive: true });
  writeFileSync(join(root, rel), text);
};
const read = (rel: string) => readFileSync(join(root, rel), 'utf8');
/** Done reports for the first n stages of a card. */
const finish = (id: string, n = STAGES.length) =>
  STAGES.slice(0, n).forEach((stage) =>
    put(`.work/reports/${id}.${stage}.json`, JSON.stringify({ id, stage, status: 'done', ...(stage === 'verifier' ? { verdicts: [{ claim: `${id}-c001`, verdict: 'supported', locator: 'p. 1' }] } : {}) })),
  );

const gitEnv = (extra: Record<string, string> = {}) => ({
  ...Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('GIT_'))),
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_NOSYSTEM: '1',
  GIT_AUTHOR_NAME: 'Fixture',
  GIT_AUTHOR_EMAIL: 'fixture@example.org',
  GIT_COMMITTER_NAME: 'Fixture',
  GIT_COMMITTER_EMAIL: 'fixture@example.org',
  GIT_CEILING_DIRECTORIES: dirname(root),
  ...extra,
});
const git = (...args: string[]) => {
  const r = spawnSync('git', ['-C', root, ...args], { encoding: 'utf8', env: gitEnv() });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout.replace(/\n$/, ''); // not trim(): a porcelain status line can start with a space
};

describe('cardFiles', () => {
  const addCard = (id: string, roles = ['micro-1', 'gross-1']) => {
    for (const f of ['meta.yaml', 'en.md', 'it.md']) put(`src/content/entities/${id}/${f}`, `${id}\n`);
    put(`docs/ledger/${id}.yaml`, `entity: ${id}\nclaims: []\n`);
    for (const r of roles) {
      put(`src/content/images/${id}-${r}.yaml`, `id: ${id}-${r}\nfile: ${id}-${r}.jpg\n`);
      put(`src/assets/images/${id}-${r}.jpg`, 'jpeg');
    }
  };

  it('lists the entity folder, the ledger, the image yaml and the image files of the card, and only those', () => {
    addCard('alpha');
    addCard('alpha-beta'); // another card whose id starts with this one
    put('src/content/images/alpha-note.yaml', 'id: x\nfile: x.jpg\n'); // not an image id (<card>-<role>-<n>)
    expect(cardFiles(root, 'alpha')).toEqual([
      'src/content/entities/alpha',
      'docs/ledger/alpha.yaml',
      'src/content/images/alpha-gross-1.yaml',
      'src/content/images/alpha-micro-1.yaml',
      'src/assets/images/alpha-gross-1.jpg',
      'src/assets/images/alpha-micro-1.jpg',
    ]);
  });

  it('leaves out what does not exist: no images folder, or an image file nobody wrote', () => {
    expect(cardFiles(root, 'alpha')).toEqual([]);
    addCard('alpha', ['micro-1']);
    rmSync(join(root, 'src/assets/images/alpha-micro-1.jpg'));
    expect(cardFiles(root, 'alpha')).toEqual(['src/content/entities/alpha', 'docs/ledger/alpha.yaml', 'src/content/images/alpha-micro-1.yaml']);
  });
});

describe('cardCheck: the default check runs scripts/agent/card-check.mjs', () => {
  const stub = (body: string) => put('scripts/agent/card-check.mjs', body);

  it('reads the JSON it prints, and the exit code decides', () => {
    stub('console.log(JSON.stringify({ id: process.argv[2], ok: true, problems: [], more: 0 }));');
    expect(cardCheck(root)('alpha')).toMatchObject({ id: 'alpha', ok: true });
    stub('console.log(JSON.stringify({ id: process.argv[2], ok: true, problems: [] })); process.exit(1);');
    expect(cardCheck(root)('alpha').ok).toBe(false);
  });

  it('reports a check that did not run, as a problem', () => {
    const r = cardCheck(root)('alpha');
    expect(r.ok).toBe(false);
    expect(r.problems[0]).toMatchObject({ gate: 'run' });
    stub('console.log("not json")');
    expect(cardCheck(root)('alpha').ok).toBe(false);
  });
});

describe('commitFinished', () => {
  const TRAILER = 'Co-Authored-By: Agent Fixture <agent@example.org>';
  const ROWS = [
    { id: 'alpha', kind: 'disease', priority: 'P0' },
    { id: 'beta', kind: 'process', priority: 'P1' },
    { id: 'gamma', kind: 'concept', priority: 'P2' },
    { id: 'alpha-beta', kind: 'pattern', priority: 'P2' },
  ];
  const files = (id: string) =>
    [
      `docs/ledger/${id}.yaml`,
      `src/assets/images/${id}-gross-1.jpg`,
      `src/assets/images/${id}-micro-1.jpg`,
      `src/content/entities/${id}/en.md`,
      `src/content/entities/${id}/it.md`,
      `src/content/entities/${id}/meta.yaml`,
      `src/content/images/${id}-gross-1.yaml`,
      `src/content/images/${id}-micro-1.yaml`,
    ].sort();
  const ok = () => ({ ok: true, problems: [] });
  const run = (check: (id: string) => unknown = ok, env: Record<string, string> = { AGENT_COAUTHOR: TRAILER }) =>
    commitFinished({ root, rows: ROWS, check: check as never, env: gitEnv(env) });
  // the script is plain JavaScript: its empty arrays are typed never[]
  const skipped = (r: { skipped: unknown[] }) => r.skipped as { id: string; reason: string }[];
  const filesOf = (rev: string) => git('show', '--name-only', '--format=', rev).split('\n').filter(Boolean).sort();

  beforeEach(() => {
    git('init', '-q', '-b', 'main');
    expect(git('rev-parse', '--show-toplevel')).toBe(root); // the throwaway repository, not an enclosing one
    put('README.md', '# fixture\n');
    put('src/content/sources.yaml', '- id: rubin-8e\n');
    git('add', '--', 'README.md', 'src/content/sources.yaml');
    git('commit', '-q', '-m', 'init');
    for (const id of ['alpha', 'beta', 'gamma', 'alpha-beta']) {
      for (const f of ['meta.yaml', 'en.md', 'it.md']) put(`src/content/entities/${id}/${f}`, `${id}\n`);
      put(`docs/ledger/${id}.yaml`, `entity: ${id}\nclaims: []\n`);
      for (const r of ['micro-1', 'gross-1']) {
        put(`src/content/images/${id}-${r}.yaml`, `id: ${id}-${r}\nfile: ${id}-${r}.jpg\n`);
        put(`src/assets/images/${id}-${r}.jpg`, 'jpeg');
      }
    }
    finish('alpha');
    finish('beta');
    finish('gamma', 3); // not finished
    finish('alpha-beta', 5); // not finished: the scout is missing
    // other work in the tree, which no commit may take
    put('src/content/sources.yaml', '- id: rubin-8e\n- id: edited\n'); // tracked and modified
    put('notes.txt', 'untracked\n');
    put('staged-other.txt', 'staged\n');
    git('add', '--', 'staged-other.txt');
  });

  it('commits each finished card with exactly its own files, one commit per card, and leaves the rest of the tree as it was', () => {
    const checked: string[] = [];
    const r = run((id) => (checked.push(id), ok()));
    expect(r).toMatchObject({ committed: ['alpha', 'beta'], skipped: [], unchanged: [], unfinished: 2 });
    expect(checked).toEqual(['alpha', 'beta']); // the check does not run for an unfinished card
    expect(git('log', '--format=%s')).toBe('feat(beta): add the card (process, P1)\nfeat(alpha): add the card (disease, P0)\ninit');
    expect(filesOf('HEAD~1')).toEqual(files('alpha')); // nothing of alpha-beta, which has a longer id
    expect(filesOf('HEAD')).toEqual(files('beta'));
    expect(git('log', '-1', '--format=%B', 'HEAD~1').split('\n').filter(Boolean)).toEqual(['feat(alpha): add the card (disease, P0)', TRAILER]);
    expect(git('diff', '--cached', '--name-only')).toBe('staged-other.txt');
    expect(git('status', '--porcelain').split('\n')).toEqual(expect.arrayContaining([' M src/content/sources.yaml', '?? notes.txt']));
    expect(git('ls-files')).not.toMatch(/gamma|alpha-beta/);
  });

  it('skips a card that fails card:check with a one-line reason, and stages nothing of it', () => {
    const failing = {
      ok: false,
      problems: [
        { gate: 'content', where: 'it.md', message: 'claim markers differ:\nc001 is missing' },
        { gate: 'words', where: 'en.md', message: 'too long' },
      ],
      more: 3,
    };
    const r = run((id) => (id === 'beta' ? failing : ok()));
    expect(r.committed).toEqual(['alpha']);
    expect(skipped(r)).toEqual([{ id: 'beta', reason: 'card:check failed: [content] claim markers differ: c001 is missing (+4 more)' }]);
    expect(git('diff', '--cached', '--name-only')).toBe('staged-other.txt');
    expect(git('log', '--format=%s')).not.toMatch(/beta/);
  });

  it('skips a card whose check did not run, and does not commit it', () => {
    const r = commitFinished({ root, rows: [ROWS[0]!], check: cardCheck(root), env: gitEnv() }); // no scripts/agent/card-check.mjs here
    expect(r.committed).toEqual([]);
    expect(skipped(r)[0]?.reason).toMatch(/^card:check failed: \[run\]/);
    expect(git('rev-list', '--count', 'HEAD')).toBe('1');
  });

  it('skips a finished card that has no file at all, rather than commit with an empty pathspec (which takes the whole index)', () => {
    finish('ghost');
    const r = commitFinished({ root, rows: [{ id: 'ghost', kind: 'process', priority: 'P2' }], check: ok, env: gitEnv() });
    expect(r.committed).toEqual([]);
    expect(skipped(r)).toEqual([{ id: 'ghost', reason: 'no file of the card exists' }]);
    expect(git('diff', '--cached', '--name-only')).toBe('staged-other.txt');
    expect(git('rev-list', '--count', 'HEAD')).toBe('1');
  });

  it('does not commit a card twice', () => {
    run();
    expect(run()).toMatchObject({ committed: [], skipped: [], unchanged: ['alpha', 'beta'], unfinished: 2 });
    expect(git('rev-list', '--count', 'HEAD')).toBe('3');
  });

  it('skips a card whose commit fails (a hook), with the reason, and unstages its files', () => {
    put('.git/hooks/pre-commit', '#!/bin/sh\necho "no verbatim text allowed" >&2\nexit 1\n');
    chmodSync(join(root, '.git/hooks/pre-commit'), 0o755);
    const r = run();
    expect(r.committed).toEqual([]);
    expect(skipped(r).map((s) => s.id)).toEqual(['alpha', 'beta']);
    expect(skipped(r)[0]?.reason).toMatch(/^git commit failed: .*no verbatim text allowed/);
    expect(skipped(r)[0]?.reason).not.toMatch(/\n/);
    expect(git('diff', '--cached', '--name-only')).toBe('staged-other.txt');
    expect(git('rev-list', '--count', 'HEAD')).toBe('1');
  });

  it('writes the trailer of AGENT_COAUTHOR, adds the prefix when it holds only a name, and none when it is unset', () => {
    commitFinished({ root, rows: [ROWS[0]!], check: ok, env: gitEnv({ AGENT_COAUTHOR: 'Bare Name <bare@example.org>' }) });
    commitFinished({ root, rows: [ROWS[1]!], check: ok, env: gitEnv() });
    expect(git('log', '-1', '--format=%B', 'HEAD~1').trim().split('\n').pop()).toBe('Co-Authored-By: Bare Name <bare@example.org>');
    expect(git('log', '-1', '--format=%B', 'HEAD').trim()).toBe('feat(beta): add the card (process, P1)');
  });
});

describe('self-verified entries', () => {
  const ledger = (entity: string, verifiers: string[]) =>
    `entity: ${entity}\nclaims:\n${verifiers.map((v, i) => `  - claimId: ${entity}-c${i + 1}\n    verifier: ${JSON.stringify(v)}\n    verifiedBy: agent\n`).join('')}`;
  const names = (it: string, en: string, key = 'names') => `${key}:\n  it: ${JSON.stringify(it)}\n  en: ${JSON.stringify(en)}\n`;
  const SV_PRE = `/** Pages with claims checked only by their writer. */
export type SelfVerified = { ledger: string; claims: number; name: { it: string; en: string }; path: string };

export const SELF_VERIFIED: readonly SelfVerified[] = `;
  const SV_POST = `

export const isSelfVerifier = (verifier: string) => /author|fixer/i.test(verifier);
`;
  const SV_HEAD = `${SV_PRE}[\n`;
  const SV_TAIL = `];${SV_POST}`;
  const LONG = { it: 'Controllo di qualità delle proteine e dei chaperoni nella risposta cellulare allo stress', en: 'Protein and chaperone quality control in the cellular stress response' };
  const EXPECTED = `  { ledger: 'alpha', claims: 2, name: { it: 'Alfa', en: 'Alpha' }, path: 'e/alpha/' },
  {
    ledger: 'epsilon',
    claims: 1,
    name: { it: '${LONG.it}', en: '${LONG.en}' },
    path: 'e/epsilon/',
  },
  { ledger: 'gamma', claims: 1, name: { it: "Necrosi dell'alfa", en: 'Gamma necrosis' }, path: 'e/gamma/' },
  { ledger: 'p02-pattern', claims: 3, name: { it: 'Modello due', en: 'Pattern two' }, path: 'pattern/p02-pattern/' },
  { ledger: 'pathway-zeta', claims: 4, name: { it: 'Via zeta', en: 'Zeta pathway' }, path: 'pathways/zeta/' },
`;

  beforeEach(() => {
    put('docs/ledger/alpha.yaml', ledger('alpha', ['alpha-author-agent', 'fixer-agent (reworded after review)', 'verifier-agent']));
    put('docs/ledger/beta.yaml', ledger('beta', ['verifier-agent', 'independent-verifier-agent'])); // nothing self-checked: no entry
    put('docs/ledger/gamma.yaml', ledger('gamma', ['gamma-author-agent']));
    put('docs/ledger/epsilon.yaml', ledger('epsilon', ['fixer-agent']));
    put('docs/ledger/p02-pattern.yaml', ledger('p02-pattern', ['p02-author-agent', 'fixer-agent', 'fixer-agent']));
    put('docs/ledger/pathway-zeta.yaml', ledger('pathway-zeta', Array(4).fill('pathway-author-agent')));
    put('src/content/entities/alpha/meta.yaml', `id: alpha\n${names('Alfa', 'Alpha')}`);
    put('src/content/entities/beta/meta.yaml', `id: beta\n${names('Beta', 'Beta')}`);
    put('src/content/entities/gamma/meta.yaml', `id: gamma\n${names("Necrosi dell'alfa", 'Gamma necrosis')}`);
    put('src/content/entities/epsilon/meta.yaml', `id: epsilon\n${names(LONG.it, LONG.en)}`);
    put('src/content/patterns/p02-pattern/meta.yaml', `id: p02-pattern\n${names('Modello due', 'Pattern two')}`);
    put('src/content/pathways/zeta.yaml', `id: zeta\n${names('Via zeta', 'Zeta pathway', 'title')}`);
  });

  it('has one entry per ledger with author or fixer rows, with exact counts, names and paths, sorted by ledger', () => {
    const { entries, problems } = selfVerified(root);
    expect(problems).toEqual([]);
    expect(entries.map((e: { ledger: string; claims: number }) => [e.ledger, e.claims])).toEqual([['alpha', 2], ['epsilon', 1], ['gamma', 1], ['p02-pattern', 3], ['pathway-zeta', 4]]);
    expect(entries[0]).toEqual({ ledger: 'alpha', claims: 2, name: { it: 'Alfa', en: 'Alpha' }, path: 'e/alpha/' });
    expect(entries[3]).toMatchObject({ path: 'pattern/p02-pattern/', name: { en: 'Pattern two' } });
    expect(entries[4]).toMatchObject({ path: 'pathways/zeta/', name: { en: 'Zeta pathway' } });
  });

  it('counts the verifier strings the way isSelfVerifier does (tests/ledger-verifier.test.ts)', () => {
    const verifiers = ['pathway-author-agent', 'p01-author-agent (second-pass page re-read)', 'fixer-agent', 'fixer-agent (reworded after review; checked against rubin-8e p. 49)', 'verifier-agent', 'independent-verifier-agent', 'Author'];
    put('docs/ledger/alpha.yaml', ledger('alpha', verifiers));
    expect(selfVerified(root).entries[0]?.claims).toBe(verifiers.filter(isSelfVerifier).length);
  });

  it('reports a ledger that matches no entity, pattern or pathway, and lists nothing for it', () => {
    put('docs/ledger/orphan.yaml', ledger('orphan', ['fixer-agent']));
    put('docs/ledger/pathway-lost.yaml', ledger('pathway-lost', ['pathway-author-agent']));
    const { entries, problems } = selfVerified(root);
    expect(entries).toHaveLength(5);
    expect(problems).toHaveLength(2);
    expect(problems.join('\n')).toMatch(/orphan[\s\S]*pathway-lost/);
  });

  it('rewrites only the SELF_VERIFIED literal: the rest of the file is kept, an apostrophe takes double quotes, a long entry wraps', () => {
    const stale = "  { ledger: 'beta', claims: 5, name: { it: 'Beta', en: 'Beta' }, path: 'e/beta/' },\n";
    const out = renderSelfVerified(SV_HEAD + stale + SV_TAIL, selfVerified(root).entries);
    expect(out).toBe(SV_HEAD + EXPECTED + SV_TAIL);
    expect(renderSelfVerified(out, selfVerified(root).entries)).toBe(out); // idempotent
  });

  it('writes an empty list as [] when no claim is self-checked any more, and refuses a file without the literal', () => {
    expect(renderSelfVerified(SV_HEAD + EXPECTED + SV_TAIL, [])).toBe(`${SV_PRE}[];${SV_POST}`);
    expect(() => renderSelfVerified('export const OTHER = [];\n', [])).toThrow(/SELF_VERIFIED/);
  });

  describe('on the real ledgers', () => {
    const REAL = fileURLToPath(new URL('../', import.meta.url));

    it('equal SELF_VERIFIED, which tests/ledger-verifier.test.ts keeps equal to the ledgers', () => {
      const { entries, problems } = selfVerified(REAL);
      expect(problems).toEqual([]);
      expect(entries).toEqual(SELF_VERIFIED);
    });

    it('rewrite src/lib/self-verified.ts without a change', () => {
      const source = readFileSync(join(REAL, 'src/lib/self-verified.ts'), 'utf8');
      expect(renderSelfVerified(source, selfVerified(REAL).entries)).toBe(source);
    });
  });
});

describe('merging fragments (CONTRACTS §6)', () => {
  const frag = (from: string, text: string) => ({ from, text });

  describe('mergeRows: review-queue.md and missing-assets.md', () => {
    const TABLE = `# Review queue

| Date | Entity / file | Claim id or section | Issue | Status | Opened by | Closed by |
|---|---|---|---|---|---|---|
| YYYY-MM-DD | \`<entity-id>\` | \`<entity-id>-c###\` | what needs a human decision | open | agent run id | reviewer |

## Entries

| Date | Entity / file | Claim id or section | Issue | Status | Opened by | Closed by |
|---|---|---|---|---|---|---|
| 2026-10-10 | \`old\` | \`old-c001\` | An existing item. | open | image-agent | |

Note after the table.
`;
    const A = `| 2026-11-12 | \`alpha\` | \`alpha-c003\` | Beyond the reference; confirm. | open | author-agent | |
| 2026-11-12 | \`alpha\` | \`#morphology\` | A terminology choice. | open | author-agent | |
`;
    const B = `| Date | Entity / file | Claim id or section | Issue | Status | Opened by | Closed by |
|---|---|---|---|---|---|---|
| 2026-11-13 | \`alpha\` | \`#morphology\` | A terminology choice. | open | author-agent | |
| 2026-11-13 | \`old\` | \`old-c001\` | An existing item. | open | image-agent | |
| 2026-11-13 | \`beta\` | \`beta-c001\` | A beta issue. | open | author-agent | |
| 2026-11-13 | \`beta\` | \`beta-c002\` | has a stray | pipe | open | author-agent | |
Free text that is not a row.
`;

    it('appends the new rows after the last row of the table, one row per distinct text (the date does not count)', () => {
      const r = mergeRows(TABLE, [frag('alpha', A), frag('beta', B)]);
      expect(r.added).toBe(3);
      expect(r.text).toBe(
        TABLE.replace(
          '| open | image-agent | |\n',
          `| open | image-agent | |
| 2026-11-12 | \`alpha\` | \`alpha-c003\` | Beyond the reference; confirm. | open | author-agent | |
| 2026-11-12 | \`alpha\` | \`#morphology\` | A terminology choice. | open | author-agent | |
| 2026-11-13 | \`beta\` | \`beta-c001\` | A beta issue. | open | author-agent | |
`,
        ),
      );
    });

    it('says which row it could not use: a row with the wrong number of cells', () => {
      const r = mergeRows(TABLE, [frag('beta', B)]);
      expect(r.problems).toHaveLength(1);
      expect(r.problems[0]).toMatch(/^beta: .*beta-c002/);
    });

    it('changes nothing when every row is known, so a second run adds nothing', () => {
      const once = mergeRows(TABLE, [frag('alpha', A)]).text;
      expect(mergeRows(once, [frag('alpha', A)])).toMatchObject({ text: once, added: 0, problems: [] });
    });
  });

  describe('mergeSources: sources.yaml', () => {
    const SOURCES = `# Machine registry of sources.
- id: rubin-8e
  title: "Rubin's Pathology"
  kind: textbook
  existsVerified: { via: publisher, date: 2026-10-10 }
`;
    const A = `
# Second source for alpha (docs/ledger/alpha.yaml c003).
- id: new-1
  title: "A paper"
  year: 2020
  kind: article
  existsVerified: { via: pubmed, date: 2026-11-12 }

- id: rubin-8e
  title: "a duplicate of an existing id"
  kind: textbook
`;
    const B = `- id: new-1
  title: "the same source, from another card"
  kind: article

- id: new-2
  title: "Another paper"
  kind: article
`;

    it('appends the entries in the format of the file, with their comment, one entry per id', () => {
      const r = mergeSources(SOURCES, [frag('alpha', A), frag('beta', B)]);
      expect(r.added).toBe(2);
      expect(r.problems).toEqual([]);
      expect(r.text).toBe(`${SOURCES}
# Second source for alpha (docs/ledger/alpha.yaml c003).
- id: new-1
  title: "A paper"
  year: 2020
  kind: article
  existsVerified: { via: pubmed, date: 2026-11-12 }

- id: new-2
  title: "Another paper"
  kind: article
`);
    });

    it('changes nothing when every id is known, and reports a fragment that is not a list of entries with an id', () => {
      const once = mergeSources(SOURCES, [frag('alpha', A)]).text;
      expect(mergeSources(once, [frag('alpha', A)])).toMatchObject({ text: once, added: 0, problems: [] });
      const bad = mergeSources(SOURCES, [frag('a', 'id: x\n'), frag('b', '- title: no id\n'), frag('c', '- id: [unclosed\n'), frag('d', '# only a comment\n')]);
      expect(bad.text).toBe(SOURCES);
      expect(bad.problems).toHaveLength(3);
      expect(bad.problems.map((p: string) => p.split(':')[0])).toEqual(['a', 'b', 'c']);
    });
  });

  describe('mergePlanned: planned.yaml into modules.yaml', () => {
    const MODULES = `# Modules.
- id: g02
  status: planned
  planned:
    - id: acute-inflammation
      names: { it: "Infiammazione acuta", en: "Acute inflammation" }
- id: g03
  status: planned
`;
    const A = `- module: g02
  id: new-card
  names: { it: "Nuova scheda", en: "New card" }
- module: g02
  id: acute-inflammation
  names: { it: "Infiammazione acuta", en: "Acute inflammation" }
- module: g03
  id: third-card
  names: { it: "Terza scheda", en: "Third card" }
- module: g99
  id: lost-card
  names: { it: "Persa", en: "Lost" }
- module: g03
  id: nameless
`;

    it('adds each id to the planned list of its module, creates the list when there is none, and skips known ids', () => {
      const r = mergePlanned(MODULES, [frag('alpha', A)]);
      expect(r.added).toBe(2);
      expect(r.text).toBe(`# Modules.
- id: g02
  status: planned
  planned:
    - id: acute-inflammation
      names: { it: "Infiammazione acuta", en: "Acute inflammation" }
    - id: new-card
      names: { it: "Nuova scheda", en: "New card" }
- id: g03
  status: planned
  planned:
    - id: third-card
      names: { it: "Terza scheda", en: "Third card" }
`);
      expect(mergePlanned(r.text, [frag('alpha', A)]).added).toBe(0);
    });

    it('reports an unknown module and an entry without names', () => {
      const { problems } = mergePlanned(MODULES, [frag('alpha', A)]);
      expect(problems).toHaveLength(2);
      expect(problems[0]).toMatch(/^alpha: .*g99/);
      expect(problems[1]).toMatch(/^alpha: .*nameless/);
    });
  });
});

describe('finalize (CONTRACTS §5)', () => {
  const header = '| Date | Entity / file | Claim id or section | Issue | Status | Opened by | Closed by |\n|---|---|---|---|---|---|---|\n';
  const assets = '| Date | Entity / pattern | Role | What it should show | Candidate | Blocker | Status |\n|---|---|---|---|---|---|---|\n';
  const MANIFEST = [
    { id: 'alpha', batch: 'W02', kind: 'disease', priority: 'P0' },
    { id: 'beta', batch: 'W02', kind: 'process', priority: 'P1' },
    { id: 'gamma', batch: 'W02', kind: 'concept', priority: 'P2' }, // not finished: its fragments are not merged
    { id: 'delta', batch: 'W03', kind: 'disease', priority: 'P0' }, // another batch
  ];
  const SELF = `export type SelfVerified = { ledger: string };

export const SELF_VERIFIED: readonly SelfVerified[] = [
  { ledger: 'beta', claims: 5, name: { it: 'Beta', en: 'Beta' }, path: 'e/beta/' },
];
`;

  beforeEach(() => {
    put('.work/manifest.json', JSON.stringify(MANIFEST));
    for (const id of ['alpha', 'beta', 'delta']) finish(id);
    finish('gamma', 4);
    put('docs/ledger/alpha.yaml', 'entity: alpha\nclaims:\n  - { claimId: alpha-c1, verifier: alpha-author-agent }\n  - { claimId: alpha-c2, verifier: verifier-agent }\n');
    put('docs/ledger/beta.yaml', 'entity: beta\nclaims:\n  - { claimId: beta-c1, verifier: verifier-agent }\n');
    put('src/content/entities/alpha/meta.yaml', 'id: alpha\nnames:\n  it: Alfa\n  en: Alpha\n');
    put('src/lib/self-verified.ts', SELF);
    put('src/content/sources.yaml', '- id: rubin-8e\n  title: "Rubin"\n');
    put('src/content/modules.yaml', '- id: g02\n  status: planned\n');
    put('docs/REVIEW_QUEUE.md', `# Review queue\n\n${header}| 2026-10-10 | \`old\` | \`old-c001\` | Known. | open | image-agent | |\n`);
    put('docs/MISSING_ASSETS.md', `# Missing assets\n\n${assets}| 2026-10-10 | \`old\` | gross | Known gap | none found | license | open |\n`);
    put('.work/fragments/alpha/sources.yaml', '# Second source for alpha.\n- id: new-1\n  title: "A paper"\n');
    put('.work/fragments/beta/sources.yaml', '- id: new-1\n  title: "A paper"\n\n- id: new-2\n  title: "Another paper"\n');
    put('.work/fragments/alpha/review-queue.md', '| 2026-11-12 | `alpha` | `alpha-c001` | An issue. | open | author-agent | |\n');
    put('.work/fragments/beta/review-queue.md', '| 2026-11-13 | `alpha` | `alpha-c001` | An issue. | open | author-agent | |\n| 2026-11-13 | `beta` | `#x` | has a stray | pipe | open | author-agent | |\n');
    put('.work/fragments/alpha/missing-assets.md', '| 2026-11-12 | `alpha` | micro | A gap | none found | license | open |\n');
    put('.work/fragments/alpha/planned.yaml', '- module: g02\n  id: new-card\n  names: { it: "Nuova", en: "New" }\n');
    put('.work/fragments/gamma/sources.yaml', '- id: unfinished-1\n  title: "never merged"\n');
    put('.work/fragments/delta/sources.yaml', '- id: other-batch-1\n  title: "never merged"\n');
  });

  it('regenerates the self-verified entries and merges the fragments of the finished cards of the batch', () => {
    const summary = finalize({ root, batch: 'W02' });
    expect(summary).toMatchObject({
      batch: 'W02',
      cards: 2,
      unfinished: 1,
      sources: 2,
      reviewQueue: 1,
      missingAssets: 1,
      planned: 1,
      selfVerified: { entries: 1, changed: true },
    });
    expect(summary.problems).toHaveLength(1);
    expect(summary.problems[0]).toMatch(/^beta: .*#x/);
    expect(read('src/lib/self-verified.ts')).toBe(SELF.replace(/ {2}\{ ledger: 'beta'.*\n/, "  { ledger: 'alpha', claims: 1, name: { it: 'Alfa', en: 'Alpha' }, path: 'e/alpha/' },\n"));
    expect(read('src/content/sources.yaml')).toBe('- id: rubin-8e\n  title: "Rubin"\n\n# Second source for alpha.\n- id: new-1\n  title: "A paper"\n\n- id: new-2\n  title: "Another paper"\n');
    expect(read('docs/REVIEW_QUEUE.md')).toBe(`# Review queue\n\n${header}| 2026-10-10 | \`old\` | \`old-c001\` | Known. | open | image-agent | |\n| 2026-11-12 | \`alpha\` | \`alpha-c001\` | An issue. | open | author-agent | |\n`);
    expect(read('docs/MISSING_ASSETS.md')).toMatch(/\| none found \| license \| open \|\n\| 2026-11-12 \| `alpha` \| micro \| A gap \| none found \| license \| open \|\n$/);
    expect(read('src/content/modules.yaml')).toBe('- id: g02\n  status: planned\n  planned:\n    - id: new-card\n      names: { it: "Nuova", en: "New" }\n');
  });

  it('adds nothing the second time: no duplicate source, row or planned id, and no rewrite of the entries', () => {
    finalize({ root, batch: 'W02' });
    const after = ['src/lib/self-verified.ts', 'src/content/sources.yaml', 'docs/REVIEW_QUEUE.md', 'docs/MISSING_ASSETS.md', 'src/content/modules.yaml'].map(read);
    expect(finalize({ root, batch: 'W02' })).toMatchObject({ sources: 0, reviewQueue: 0, missingAssets: 0, planned: 0, selfVerified: { entries: 1, changed: false } });
    expect(['src/lib/self-verified.ts', 'src/content/sources.yaml', 'docs/REVIEW_QUEUE.md', 'docs/MISSING_ASSETS.md', 'src/content/modules.yaml'].map(read)).toEqual(after);
  });

  it('touches no shared file for which there is no fragment, and throws for a batch that is not in the manifest', () => {
    rmSync(join(root, '.work/fragments'), { recursive: true });
    const before = read('src/content/sources.yaml');
    expect(finalize({ root, batch: 'W02' })).toMatchObject({ sources: 0, reviewQueue: 0, missingAssets: 0, planned: 0 });
    expect(read('src/content/sources.yaml')).toBe(before);
    expect(() => finalize({ root, batch: 'W99' })).toThrow(/W99/);
  });
});
