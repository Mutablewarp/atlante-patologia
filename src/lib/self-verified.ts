/**
 * Pages whose claim ledger was checked only by the agent that wrote the text,
 * not by a separate verifier with fresh context (CONTENT_SCHEMA §8). The
 * Method page lists them; tests/ledger-verifier.test.ts keeps this list and
 * docs/ledger/*.yaml in agreement. Remove an entry once a separate verifier
 * has re-checked the whole ledger and is recorded in `verifier`.
 */
export type SelfVerified = { ledger: string; name: { it: string; en: string }; path: string };

export const SELF_VERIFIED: readonly SelfVerified[] = [
  { ledger: 'pathway-intrinsic-apoptosis', name: { it: 'Via intrinseca dell’apoptosi', en: 'Intrinsic apoptosis pathway' }, path: 'pathways/intrinsic-apoptosis/' },
  { ledger: 'p01-necrosis', name: { it: 'Tipi di necrosi (quadro trasversale)', en: 'Types of necrosis (pattern page)' }, path: 'pattern/p01-necrosis/' },
];

/** A ledger `verifier` that names the writing agent is not a separate verifier. */
export const isSelfVerifier = (verifier: string) => /author/i.test(verifier);
