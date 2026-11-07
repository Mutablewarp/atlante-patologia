/**
 * Pages with claims that were checked against the sources only by the agent
 * that wrote or corrected them, not by a separate verifier with fresh context
 * (CONTENT_SCHEMA §8): their ledger `verifier` names an author or a fixer agent.
 * The Method page lists them with the number of such claims, and
 * tests/ledger-verifier.test.ts keeps this list equal to docs/ledger/*.yaml.
 * Update an entry when a separate verifier re-checks those claims.
 */
export type SelfVerified = {
  ledger: string;
  /** Claims of this ledger checked only by their writer or fixer. */
  claims: number;
  name: { it: string; en: string };
  path: string;
};

export const SELF_VERIFIED: readonly SelfVerified[] = [
  { ledger: 'apoptosis', claims: 2, name: { it: 'Apoptosi', en: 'Apoptosis' }, path: 'e/apoptosis/' },
  { ledger: 'coagulative-necrosis', claims: 21, name: { it: 'Necrosi coagulativa', en: 'Coagulative necrosis' }, path: 'e/coagulative-necrosis/' },
  { ledger: 'dysplasia', claims: 21, name: { it: 'Displasia', en: 'Dysplasia' }, path: 'e/dysplasia/' },
  { ledger: 'fat-necrosis', claims: 20, name: { it: 'Necrosi adiposa (steatonecrosi)', en: 'Fat necrosis' }, path: 'e/fat-necrosis/' },
  { ledger: 'fatty-change', claims: 14, name: { it: 'Steatosi (degenerazione grassa)', en: 'Fatty change (steatosis)' }, path: 'e/fatty-change/' },
  { ledger: 'fibrinoid-necrosis', claims: 15, name: { it: 'Necrosi fibrinoide', en: 'Fibrinoid necrosis' }, path: 'e/fibrinoid-necrosis/' },
  { ledger: 'gangrene', claims: 18, name: { it: 'Gangrena', en: 'Gangrene' }, path: 'e/gangrene/' },
  { ledger: 'hydropic-swelling', claims: 11, name: { it: 'Rigonfiamento idropico (degenerazione idropica)', en: 'Hydropic (cellular) swelling' }, path: 'e/hydropic-swelling/' },
  { ledger: 'hypoxic-ischemic-injury', claims: 15, name: { it: 'Danno cellulare ipossico-ischemico', en: 'Hypoxic–ischemic cell injury' }, path: 'e/hypoxic-ischemic-injury/' },
  { ledger: 'intracellular-accumulations', claims: 12, name: { it: 'Accumuli intracellulari', en: 'Intracellular accumulations' }, path: 'e/intracellular-accumulations/' },
  { ledger: 'metaplasia', claims: 16, name: { it: 'Metaplasia', en: 'Metaplasia' }, path: 'e/metaplasia/' },
  { ledger: 'metastatic-calcification', claims: 3, name: { it: 'Calcificazione metastatica', en: 'Metastatic calcification' }, path: 'e/metastatic-calcification/' },
  { ledger: 'oxidative-injury', claims: 4, name: { it: 'Danno ossidativo (radicali liberi)', en: 'Oxidative (free-radical) injury' }, path: 'e/oxidative-injury/' },
  { ledger: 'pigment-accumulation', claims: 21, name: { it: 'Accumulo di pigmenti', en: 'Pigment accumulation' }, path: 'e/pigment-accumulation/' },
  {
    ledger: 'protein-quality-control',
    claims: 6,
    name: { it: 'Controllo di qualità delle proteine (sistema ubiquitina-proteasoma, chaperoni)', en: 'Protein quality control (ubiquitin–proteasome system, chaperones)' },
    path: 'e/protein-quality-control/',
  },
  { ledger: 'pyroptosis', claims: 13, name: { it: 'Piroptosi', en: 'Pyroptosis' }, path: 'e/pyroptosis/' },
];

/** A ledger `verifier` that names the writing or the correcting agent is not a separate verifier. */
export const isSelfVerifier = (verifier: string) => /author|fixer/i.test(verifier);

/** Ids of separate, fresh-context verifier agents; any other agent id must count as self. */
export const INDEPENDENT_VERIFIERS: readonly string[] = ['verifier-agent', 'independent-verifier-agent'];
