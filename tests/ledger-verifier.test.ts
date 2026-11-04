/**
 * CONTENT_SCHEMA §8: the verifier is a separate agent. A ledger checked only by
 * its author must be listed in SELF_VERIFIED, which the Method page shows, so
 * the public page never claims an independent check that did not happen.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { isSelfVerifier, SELF_VERIFIED } from '../src/lib/self-verified.ts';

const dir = new URL('../docs/ledger/', import.meta.url);
const ledgers = readdirSync(dir)
  .filter((f) => f.endsWith('.yaml'))
  .map((f) => parse(readFileSync(new URL(f, dir), 'utf8')) as { entity: string; claims: { verifier: string }[] });

describe('ledger verifier independence', () => {
  it('recognises author-agent verifiers', () => {
    expect(isSelfVerifier('pathway-author-agent')).toBe(true);
    expect(isSelfVerifier('p01-author-agent (second-pass page re-read)')).toBe(true);
    expect(isSelfVerifier('verifier-agent')).toBe(false);
  });
  it('lists every ledger with author-verified rows on the Method page, and nothing else', () => {
    const self = ledgers.filter((l) => l.claims.some((c) => isSelfVerifier(c.verifier))).map((l) => l.entity).sort();
    expect([...SELF_VERIFIED.map((s) => s.ledger)].sort()).toEqual(self);
  });
});
