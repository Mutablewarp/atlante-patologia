/**
 * Raw, in-memory snapshot of a content tree (the real repo or a fixture root).
 * Gates (./gates.ts) are pure functions over this snapshot, so failing cases can
 * be produced by mutating a clone instead of keeping dozens of broken trees on disk.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { parse } from 'yaml';

export type Doc = { path: string; data: unknown };
/** An entity or pattern folder. `fixture` = folder name starts with `_` (template fixture, not content). */
export type Unit = { id: string; dir: string; fixture: boolean; meta: Doc; en?: string; it?: string };

export type Tree = {
  root: string;
  entities: Unit[];
  patterns: Unit[];
  questions: Doc[];
  images: Doc[];
  glossary: Doc[];
  taxonomy: Doc[];
  modules: Doc;
  anatomy: Doc;
  sources: Doc;
  /** ledger id (file name without .yaml) → doc */
  ledgers: Map<string, Doc>;
  /** null when the REVIEWERS file is missing. */
  reviewers: string[] | null;
  /** paths relative to src/assets/images */
  assets: Set<string>;
  /** paths relative to src/assets/fixtures (draft fixture drawings, D040) */
  fixtureAssets: Set<string>;
};

const readText = (p: string) => (existsSync(p) ? readFileSync(p, 'utf8') : undefined);
const dirs = (p: string) => (existsSync(p) ? readdirSync(p).filter((f) => statSync(join(p, f)).isDirectory()) : []);
/** Question and image files whose name starts with `_` are template fixtures (H04), like `_` entity folders. */
export const isFixtureDoc = (d: Doc) => /(^|\/)_[^/]*$/.test(d.path);
const yamlFiles = (p: string) => (existsSync(p) ? readdirSync(p).filter((f) => /\.ya?ml$/.test(f)) : []);

function files(p: string, acc: string[] = []): string[] {
  if (!existsSync(p)) return acc;
  for (const f of readdirSync(p)) {
    const full = join(p, f);
    if (statSync(full).isDirectory()) files(full, acc);
    else acc.push(full);
  }
  return acc;
}

export function loadTree(root: string): Tree {
  const content = join(root, 'src/content');
  const rel = (p: string) => relative(root, p);
  const doc = (p: string): Doc => ({ path: rel(p), data: parse(readText(p) ?? 'null') });
  const units = (base: string): Unit[] =>
    dirs(base).map((folder) => {
      const dir = join(base, folder);
      return {
        id: folder.replace(/^_/, ''),
        dir: rel(dir),
        fixture: folder.startsWith('_'),
        meta: doc(join(dir, 'meta.yaml')),
        en: readText(join(dir, 'en.md')),
        it: readText(join(dir, 'it.md')),
      };
    });
  const ledgerDir = join(root, 'docs/ledger');
  const reviewers = readText(join(root, 'REVIEWERS'));
  const assetDir = join(root, 'src/assets/images');
  const fixtureAssetDir = join(root, 'src/assets/fixtures');

  return {
    root,
    entities: units(join(content, 'entities')),
    patterns: units(join(content, 'patterns')),
    questions: dirs(join(content, 'questions')).flatMap((m) =>
      yamlFiles(join(content, 'questions', m)).map((f) => doc(join(content, 'questions', m, f))),
    ),
    images: yamlFiles(join(content, 'images')).map((f) => doc(join(content, 'images', f))),
    glossary: yamlFiles(join(content, 'glossary')).map((f) => doc(join(content, 'glossary', f))),
    taxonomy: yamlFiles(join(content, 'taxonomy')).map((f) => doc(join(content, 'taxonomy', f))),
    modules: doc(join(content, 'modules.yaml')),
    anatomy: doc(join(content, 'anatomy.yaml')),
    sources: doc(join(content, 'sources.yaml')),
    ledgers: new Map(yamlFiles(ledgerDir).map((f) => [f.replace(/\.ya?ml$/, ''), doc(join(ledgerDir, f))])),
    reviewers:
      reviewers === undefined
        ? null
        : reviewers
            .split('\n')
            .map((l) => l.trim())
            .filter((l) => l && !l.startsWith('#')),
    assets: new Set(files(assetDir).map((f) => relative(assetDir, f).split('\\').join('/'))),
    fixtureAssets: new Set(files(fixtureAssetDir).map((f) => relative(fixtureAssetDir, f).split('\\').join('/'))),
  };
}
