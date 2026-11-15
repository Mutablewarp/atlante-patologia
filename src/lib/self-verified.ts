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
  {
    ledger: 'anca-associated-vasculitis',
    claims: 6,
    name: { it: 'Vasculiti ANCA-associate (GPA, MPA, EGPA)', en: 'ANCA-associated vasculitis' },
    path: 'e/anca-associated-vasculitis/',
  },
  {
    ledger: 'aortic-aneurysm',
    claims: 1,
    name: { it: "Aneurismi: classificazione; aneurisma dell'aorta", en: 'Aneurysms: classification and aortic aneurysm' },
    path: 'e/aortic-aneurysm/',
  },
  { ledger: 'apoptosis', claims: 2, name: { it: 'Apoptosi', en: 'Apoptosis' }, path: 'e/apoptosis/' },
  {
    ledger: 'arrhythmia-substrates-and-sudden-cardiac-death',
    claims: 7,
    name: { it: 'Substrati morfologici delle aritmie e morte cardiaca improvvisa', en: 'Morphological substrates of arrhythmia and sudden cardiac death' },
    path: 'e/arrhythmia-substrates-and-sudden-cardiac-death/',
  },
  { ledger: 'autophagy', claims: 3, name: { it: 'Autofagia', en: 'Autophagy' }, path: 'e/autophagy/' },
  { ledger: 'barrett-esophagus', claims: 1, name: { it: 'Esofago di Barrett', en: 'Barrett esophagus' }, path: 'e/barrett-esophagus/' },
  { ledger: 'bronchiectasis', claims: 5, name: { it: 'Bronchiectasie', en: 'Bronchiectasis' }, path: 'e/bronchiectasis/' },
  { ledger: 'carcinogenic-agents', claims: 8, name: { it: 'Agenti cancerogeni', en: 'Carcinogenic agents' }, path: 'e/carcinogenic-agents/' },
  { ledger: 'carcinoma-in-situ', claims: 1, name: { it: 'Carcinoma in situ', en: 'Carcinoma in situ' }, path: 'e/carcinoma-in-situ/' },
  { ledger: 'dysplasia', claims: 1, name: { it: 'Displasia', en: 'Dysplasia' }, path: 'e/dysplasia/' },
  { ledger: 'dystrophic-calcification', claims: 1, name: { it: 'Calcificazione distrofica', en: 'Dystrophic calcification' }, path: 'e/dystrophic-calcification/' },
  { ledger: 'emphysema', claims: 3, name: { it: 'Enfisema', en: 'Emphysema' }, path: 'e/emphysema/' },
  { ledger: 'esophageal-carcinoma', claims: 2, name: { it: "Carcinoma dell'esofago", en: 'Esophageal carcinoma' }, path: 'e/esophageal-carcinoma/' },
  { ledger: 'fat-necrosis', claims: 11, name: { it: 'Necrosi adiposa (steatonecrosi)', en: 'Fat necrosis' }, path: 'e/fat-necrosis/' },
  { ledger: 'gastric-polyps', claims: 4, name: { it: 'Polipi gastrici', en: 'Gastric polyps' }, path: 'e/gastric-polyps/' },
  {
    ledger: 'giant-cell-arteritis',
    claims: 1,
    name: { it: 'Arterite a cellule giganti (e arterite di Takayasu)', en: 'Giant cell arteritis (and Takayasu arteritis)' },
    path: 'e/giant-cell-arteritis/',
  },
  {
    ledger: 'helicobacter-pylori-gastritis',
    claims: 1,
    name: { it: 'Gastrite da Helicobacter pylori', en: 'Helicobacter pylori gastritis' },
    path: 'e/helicobacter-pylori-gastritis/',
  },
  { ledger: 'hypersensitivity-pneumonitis', claims: 4, name: { it: 'Polmonite da ipersensibilità', en: 'Hypersensitivity pneumonitis' }, path: 'e/hypersensitivity-pneumonitis/' },
  { ledger: 'hypertrophy', claims: 3, name: { it: 'Ipertrofia', en: 'Hypertrophy' }, path: 'e/hypertrophy/' },
  {
    ledger: 'idiopathic-pulmonary-fibrosis',
    claims: 2,
    name: { it: 'Fibrosi polmonare idiopatica (UIP)', en: 'Idiopathic pulmonary fibrosis (UIP pattern)' },
    path: 'e/idiopathic-pulmonary-fibrosis/',
  },
  {
    ledger: 'infectious-and-chemical-esophagitis',
    claims: 1,
    name: { it: 'Esofagiti infettive, chimiche e iatrogene', en: 'Infectious, chemical and iatrogenic esophagitis' },
    path: 'e/infectious-and-chemical-esophagitis/',
  },
  { ledger: 'kawasaki-disease', claims: 2, name: { it: 'Malattia di Kawasaki', en: 'Kawasaki disease' }, path: 'e/kawasaki-disease/' },
  { ledger: 'liquefactive-necrosis', claims: 1, name: { it: 'Necrosi colliquativa', en: 'Liquefactive necrosis' }, path: 'e/liquefactive-necrosis/' },
  { ledger: 'lung-squamous-cell-carcinoma', claims: 1, name: { it: 'Carcinoma squamoso polmonare', en: 'Lung squamous cell carcinoma' }, path: 'e/lung-squamous-cell-carcinoma/' },
  { ledger: 'malignant-hypertension', claims: 4, name: { it: 'Ipertensione maligna', en: 'Malignant hypertension' }, path: 'e/malignant-hypertension/' },
  { ledger: 'metaplasia', claims: 1, name: { it: 'Metaplasia', en: 'Metaplasia' }, path: 'e/metaplasia/' },
  { ledger: 'mitral-valve-prolapse', claims: 2, name: { it: 'Prolasso della valvola mitrale', en: 'Mitral valve prolapse' }, path: 'e/mitral-valve-prolapse/' },
  { ledger: 'myocarditis', claims: 1, name: { it: 'Miocardite', en: 'Myocarditis' }, path: 'e/myocarditis/' },
  {
    ledger: 'other-regulated-cell-death',
    claims: 17,
    name: { it: 'Altre forme di morte cellulare regolata (anoikis, NETosi, entosi, morte da granzimi)', en: 'Other regulated cell death (anoikis, NETosis, entosis, granzyme-mediated)' },
    path: 'e/other-regulated-cell-death/',
  },
  { ledger: 'peptic-ulcer-disease', claims: 3, name: { it: 'Ulcera peptica', en: 'Peptic ulcer disease' }, path: 'e/peptic-ulcer-disease/' },
  { ledger: 'pigment-accumulation', claims: 2, name: { it: 'Accumulo di pigmenti', en: 'Pigment accumulation' }, path: 'e/pigment-accumulation/' },
  {
    ledger: 'pleural-effusion-and-pleural-fluid-cytology',
    claims: 6,
    name: { it: 'Versamento pleurico, pleuriti e citologia del liquido pleurico', en: 'Pleural effusion, pleuritis and pleural-fluid cytology' },
    path: 'e/pleural-effusion-and-pleural-fluid-cytology/',
  },
  { ledger: 'polyarteritis-nodosa', claims: 1, name: { it: 'Poliarterite nodosa', en: 'Polyarteritis nodosa' }, path: 'e/polyarteritis-nodosa/' },
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
  { ledger: 'sarcoidosis', claims: 12, name: { it: 'Sarcoidosi', en: 'Sarcoidosis' }, path: 'e/sarcoidosis/' },
  {
    ledger: 'solitary-fibrous-tumor-of-pleura',
    claims: 9,
    name: { it: 'Tumore fibroso solitario della pleura', en: 'Solitary fibrous tumor of the pleura' },
    path: 'e/solitary-fibrous-tumor-of-pleura/',
  },
  {
    ledger: 'thromboangiitis-obliterans',
    claims: 2,
    name: { it: 'Tromboangioite obliterante (malattia di Buerger)', en: 'Thromboangiitis obliterans (Buerger disease)' },
    path: 'e/thromboangiitis-obliterans/',
  },
  { ledger: 'thrombosis', claims: 2, name: { it: 'Trombosi', en: 'Thrombosis' }, path: 'e/thrombosis/' },
  { ledger: 'vascular-tumors', claims: 3, name: { it: 'Tumori vascolari (emangioma, angiosarcoma, sarcoma di Kaposi)', en: 'Vascular tumors' }, path: 'e/vascular-tumors/' },
];

/** A ledger `verifier` that names the writing or the correcting agent is not a separate verifier. */
export const isSelfVerifier = (verifier: string) => /author|fixer/i.test(verifier);

/** Ids of separate, fresh-context verifier agents; any other agent id must count as self. */
export const INDEPENDENT_VERIFIERS: readonly string[] = ['verifier-agent', 'independent-verifier-agent'];
