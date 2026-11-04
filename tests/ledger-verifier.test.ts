/**
 * CONTENT_SCHEMA §8: the verifier is a separate agent. A claim checked only by
 * the agent that wrote or corrected it ("author" or "fixer" in `verifier`) must
 * be counted in SELF_VERIFIED, which the Method page shows, so the public page
 * never claims an independent check that did not happen.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { INDEPENDENT_VERIFIERS, isSelfVerifier, SELF_VERIFIED } from '../src/lib/self-verified.ts';

type Ledger = { entity: string; claims: { claimId: string; verifier: string; verifiedBy: string }[] };
const root = new URL('../', import.meta.url);
const dir = new URL('docs/ledger/', root);
const ledgers = readdirSync(dir)
  .filter((f) => f.endsWith('.yaml'))
  .map((f) => parse(readFileSync(new URL(f, dir), 'utf8')) as Ledger);

describe('ledger verifier independence', () => {
  it('counts author and fixer agents as self, separate verifiers as independent', () => {
    expect(isSelfVerifier('pathway-author-agent')).toBe(true);
    expect(isSelfVerifier('p01-author-agent (second-pass page re-read)')).toBe(true);
    expect(isSelfVerifier('fixer-agent')).toBe(true);
    expect(isSelfVerifier('fixer-agent (reworded after review; checked against rubin-8e p. 49)')).toBe(true);
    expect(isSelfVerifier('verifier-agent')).toBe(false);
    expect(isSelfVerifier('independent-verifier-agent')).toBe(false);
  });

  it('accepts as independent only the known verifier agents or a human reviewer', () => {
    const unknown = ledgers.flatMap((l) =>
      l.claims
        .filter((c) => c.verifiedBy !== 'human' && !isSelfVerifier(c.verifier) && !INDEPENDENT_VERIFIERS.includes(c.verifier))
        .map((c) => `${c.claimId}: ${c.verifier}`),
    );
    expect(unknown).toEqual([]);
  });

  it('lists every ledger with writer-checked claims on the Method page, with their number, and nothing else', () => {
    const self = Object.fromEntries(
      ledgers.map((l) => [l.entity, l.claims.filter((c) => isSelfVerifier(c.verifier)).length] as const).filter(([, n]) => n > 0),
    );
    expect(Object.fromEntries(SELF_VERIFIED.map((s) => [s.ledger, s.claims]))).toEqual(self);
  });

  it('links each listed card under its own name', () => {
    for (const s of SELF_VERIFIED) {
      const meta = new URL(`src/content/entities/${s.ledger}/meta.yaml`, root);
      if (!existsSync(meta)) continue; // pathway and pattern pages carry their own name (checked below for the path)
      const { names } = parse(readFileSync(meta, 'utf8')) as { names: { it: string; en: string } };
      expect(s.path, s.ledger).toBe(`e/${s.ledger}/`);
      expect(s.name, s.ledger).toEqual({ it: names.it, en: names.en });
    }
  });

  it('links listed pathway and pattern pages to their own URL', () => {
    for (const s of SELF_VERIFIED) {
      const pathway = s.ledger.match(/^pathway-(.+)$/)?.[1];
      if (pathway) {
        expect(existsSync(new URL(`src/content/pathways/${pathway}.yaml`, root)), s.ledger).toBe(true);
        expect(s.path, s.ledger).toBe(`pathways/${pathway}/`);
      } else if (existsSync(new URL(`src/content/patterns/${s.ledger}/meta.yaml`, root))) expect(s.path, s.ledger).toBe(`pattern/${s.ledger}/`);
      else expect(existsSync(new URL(`src/content/entities/${s.ledger}/meta.yaml`, root)), `${s.ledger}: no entity, pattern or pathway`).toBe(true);
    }
  });
});
