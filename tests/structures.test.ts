/**
 * Parse test: every committed structure loads with the same 3Dmol build the
 * viewer uses (2.5.5, BinaryCIF), with the atom count the ModelServer text CIF
 * gives (3Dmol drops hydrogens and keeps the first alternate location only), the
 * recorded chains, and a non-empty selection for every pathway highlight.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { beforeAll, describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { pathwaySchema, structureSchema } from '../src/lib/schema.ts';

type Atom = { chain: string; resi: number; resn: string };
type Parsers = { BCIF: (data: Uint8Array, options: object) => Atom[][] };

const root = new URL('../', import.meta.url);
const read = (p: string) => parse(readFileSync(new URL(p, root), 'utf8'));
const structures = readdirSync(new URL('src/content/structures/', root))
  .filter((f) => f.endsWith('.yaml'))
  .map((f) => structureSchema.parse(read(`src/content/structures/${f}`)));
const steps = readdirSync(new URL('src/content/pathways/', root))
  .filter((f) => f.endsWith('.yaml'))
  .flatMap((f) => pathwaySchema.parse(read(`src/content/pathways/${f}`)).steps);

let Parsers: Parsers;
beforeAll(async () => {
  // The browser build touches `document` when it loads (auto-init of class="viewer_3Dmoljs", which we never use).
  const g = globalThis as { document?: unknown; window?: unknown };
  g.document ??= { querySelector: () => null, querySelectorAll: () => [] };
  g.window ??= globalThis;
  ({ Parsers } = (await import('3dmol/build/3Dmol.es6-min.js')) as unknown as { Parsers: Parsers });
});

describe('committed structures parse with 3Dmol 2.5.5', () => {
  for (const s of structures) {
    it(`${s.pdb}: atoms and chains`, () => {
      const bytes = new Uint8Array(gunzipSync(readFileSync(new URL(`public/${s.file}`, root))));
      const models = Parsers.BCIF(bytes, {});
      expect(models).toHaveLength(1);
      const atoms = models[0]!;
      expect(atoms.length).toBe(s.atomCount - s.hydrogenAtoms - s.extraAltLocAtoms);
      expect(new Set(atoms.map((a) => a.chain))).toEqual(new Set(s.chains.map((c) => c.id)));
      for (const step of steps.filter((x) => x.structure === s.id && x.highlight)) {
        const h = step.highlight!;
        const [lo, hi] = (h.resi ?? '').split('-').map(Number);
        const hit = atoms.filter(
          (a) =>
            (!s.show || s.show.includes(a.chain)) &&
            (!h.chains || h.chains.includes(a.chain)) &&
            (!h.resn || h.resn.includes(a.resn)) &&
            (h.resi === undefined || (a.resi >= lo! && a.resi <= (hi ?? lo!))),
        );
        expect(hit.length, `${step.id} highlight`).toBeGreaterThan(0);
      }
    });
  }
});
