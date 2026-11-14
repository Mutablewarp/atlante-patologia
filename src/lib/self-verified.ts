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
  {
    ledger: 'arrhythmia-substrates-and-sudden-cardiac-death',
    claims: 7,
    name: { it: 'Substrati morfologici delle aritmie e morte cardiaca improvvisa', en: 'Morphological substrates of arrhythmia and sudden cardiac death' },
    path: 'e/arrhythmia-substrates-and-sudden-cardiac-death/',
  },
  { ledger: 'autophagy', claims: 3, name: { it: 'Autofagia', en: 'Autophagy' }, path: 'e/autophagy/' },
  { ledger: 'carcinogenic-agents', claims: 8, name: { it: 'Agenti cancerogeni', en: 'Carcinogenic agents' }, path: 'e/carcinogenic-agents/' },
  { ledger: 'carcinoma-in-situ', claims: 1, name: { it: 'Carcinoma in situ', en: 'Carcinoma in situ' }, path: 'e/carcinoma-in-situ/' },
  { ledger: 'dysplasia', claims: 1, name: { it: 'Displasia', en: 'Dysplasia' }, path: 'e/dysplasia/' },
  { ledger: 'dystrophic-calcification', claims: 1, name: { it: 'Calcificazione distrofica', en: 'Dystrophic calcification' }, path: 'e/dystrophic-calcification/' },
  { ledger: 'fat-necrosis', claims: 11, name: { it: 'Necrosi adiposa (steatonecrosi)', en: 'Fat necrosis' }, path: 'e/fat-necrosis/' },
  { ledger: 'hypertrophy', claims: 3, name: { it: 'Ipertrofia', en: 'Hypertrophy' }, path: 'e/hypertrophy/' },
  { ledger: 'liquefactive-necrosis', claims: 1, name: { it: 'Necrosi colliquativa', en: 'Liquefactive necrosis' }, path: 'e/liquefactive-necrosis/' },
  { ledger: 'metaplasia', claims: 1, name: { it: 'Metaplasia', en: 'Metaplasia' }, path: 'e/metaplasia/' },
  { ledger: 'mitral-valve-prolapse', claims: 2, name: { it: 'Prolasso della valvola mitrale', en: 'Mitral valve prolapse' }, path: 'e/mitral-valve-prolapse/' },
  { ledger: 'myocarditis', claims: 1, name: { it: 'Miocardite', en: 'Myocarditis' }, path: 'e/myocarditis/' },
  {
    ledger: 'other-regulated-cell-death',
    claims: 17,
    name: { it: 'Altre forme di morte cellulare regolata (anoikis, NETosi, entosi, morte da granzimi)', en: 'Other regulated cell death (anoikis, NETosis, entosis, granzyme-mediated)' },
    path: 'e/other-regulated-cell-death/',
  },
  { ledger: 'pigment-accumulation', claims: 2, name: { it: 'Accumulo di pigmenti', en: 'Pigment accumulation' }, path: 'e/pigment-accumulation/' },
  {
    ledger: 'protein-quality-control',
    claims: 1,
    name: { it: 'Controllo di qualità delle proteine (sistema ubiquitina-proteasoma, chaperoni)', en: 'Protein quality control (ubiquitin–proteasome system, chaperones)' },
    path: 'e/protein-quality-control/',
  },
  {
    ledger: 'rheumatic-heart-disease',
    claims: 1,
    name: { it: 'Febbre reumatica e cardiopatia reumatica', en: 'Rheumatic fever and rheumatic heart disease' },
    path: 'e/rheumatic-heart-disease/',
  },
  { ledger: 'thrombosis', claims: 2, name: { it: 'Trombosi', en: 'Thrombosis' }, path: 'e/thrombosis/' },
];

/** A ledger `verifier` that names the writing or the correcting agent is not a separate verifier. */
export const isSelfVerifier = (verifier: string) => /author|fixer/i.test(verifier);

/** Ids of separate, fresh-context verifier agents; any other agent id must count as self. */
export const INDEPENDENT_VERIFIERS: readonly string[] = ['verifier-agent', 'independent-verifier-agent'];
