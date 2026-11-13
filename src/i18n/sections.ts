/**
 * The 13 fixed entity sections (CONTENT_SCHEMA §1b) plus the rendered Quick check.
 * Anchor ids are language-neutral, so `#micro` works in both languages.
 * The H2 titles in `it.md` / `en.md` must match these strings exactly.
 */
import type { L, Lang } from './index.ts';
import type { Entity } from '../lib/schema.ts'; // type only: schema.ts imports SECTIONS from here

export type SectionDef = { id: string; title: L; short: L; quick: boolean };

export const SECTIONS: readonly SectionDef[] = [
  { id: 'definition', quick: true, title: { en: 'Definition and epidemiology', it: 'Definizione ed epidemiologia' }, short: { en: 'Definition', it: 'Definizione' } },
  { id: 'etiology', quick: false, title: { en: 'Etiology and risk factors', it: 'Eziologia e fattori di rischio' }, short: { en: 'Etiology', it: 'Eziologia' } },
  { id: 'pathogenesis', quick: false, title: { en: 'Pathogenesis', it: 'Patogenesi' }, short: { en: 'Pathogenesis', it: 'Patogenesi' } },
  { id: 'gross', quick: false, title: { en: 'Gross morphology', it: 'Morfologia macroscopica' }, short: { en: 'Gross', it: 'Macroscopia' } },
  { id: 'micro', quick: false, title: { en: 'Microscopic morphology', it: 'Morfologia microscopica' }, short: { en: 'Micro', it: 'Microscopia' } },
  { id: 'ancillary', quick: false, title: { en: 'Special stains, IHC and molecular findings', it: 'Colorazioni speciali, IIC e reperti molecolari' }, short: { en: 'Stains & IHC', it: 'Colorazioni e IIC' } },
  { id: 'clinical', quick: false, title: { en: 'Clinical presentation', it: 'Presentazione clinica' }, short: { en: 'Clinical', it: 'Clinica' } },
  { id: 'diagnosis', quick: false, title: { en: 'Diagnosis, key lab and imaging', it: 'Diagnosi, laboratorio e imaging' }, short: { en: 'Diagnosis', it: 'Diagnosi' } },
  { id: 'prognosis', quick: false, title: { en: 'Complications and prognosis', it: 'Complicanze e prognosi' }, short: { en: 'Prognosis', it: 'Prognosi' } },
  { id: 'differential', quick: true, title: { en: 'Differential diagnosis', it: 'Diagnosi differenziale' }, short: { en: 'Differential', it: 'Differenziale' } },
  { id: 'high-yield', quick: true, title: { en: 'High-yield summary', it: 'Punti chiave' }, short: { en: 'High-yield', it: 'Punti chiave' } },
  { id: 'traps', quick: true, title: { en: 'Common misconceptions and exam traps', it: "Errori comuni e trappole d'esame" }, short: { en: 'Traps', it: 'Trappole' } },
  { id: 'mnemonics', quick: false, title: { en: 'Mnemonics', it: 'Mnemotecniche' }, short: { en: 'Mnemonics', it: 'Mnemotecniche' } },
] as const;

export const QUICK_CHECK: SectionDef = {
  id: 'quick-check',
  quick: true,
  title: { en: 'Quick check', it: 'Verifica rapida' },
  short: { en: 'Quick check', it: 'Verifica' },
};

/** Titles that a `kind: technique` card shows in place of the canonical ones (CONTENT_SCHEMA §1b). The ids and the H2s in the files stay canonical. */
const TECHNIQUE_TITLES: Readonly<Record<string, L>> = {
  definition: { en: 'Principle and aims', it: 'Principio e scopi' },
  etiology: { en: 'Indications', it: 'Indicazioni' },
  pathogenesis: { en: 'Steps of the method', it: 'Fasi del metodo' },
  gross: { en: 'Gross handling', it: 'Gestione macroscopica' },
  micro: { en: 'What the slide or smear shows', it: 'Cosa mostra il vetrino o lo striscio' },
  ancillary: { en: 'Related tests', it: 'Test correlati' },
  clinical: { en: 'Clinical use', it: 'Uso clinico' },
  diagnosis: { en: 'Interpretation and reporting', it: 'Interpretazione e refertazione' },
  prognosis: { en: 'Limits and cost of errors', it: 'Limiti e costo degli errori' },
  differential: { en: 'Compared with other techniques', it: 'Confronto con altre tecniche' },
};

/**
 * Name of a section on a card of this `kind`: the entity page (heading, contents list, "continue" links), its exam-question
 * links, the quiz and oral back-links and the learner's lists (the highlights badge reads the kind from the study index, the
 * resume tile from the recent record). `short` is the contents-list label; a remapped title has no shorter form.
 * Compare rows (several cards at once) keep the generic names.
 */
export function sectionTitle(id: string, kind: Entity['kind'] | undefined, lang: Lang, short = false): string {
  const def = id === QUICK_CHECK.id ? QUICK_CHECK : SECTIONS.find((s) => s.id === id);
  const remapped = kind === 'technique' ? TECHNIQUE_TITLES[id]?.[lang] : undefined;
  return remapped ?? (short ? def?.short[lang] : def?.title[lang]) ?? id;
}

/** Sections shown in the printed one-page summary. */
export const PRINT_SECTIONS = ['high-yield', 'differential', 'traps'] as const;

/** Map a localized H2 title (either language) to its anchor id. */
export function sectionIdForTitle(title: string): SectionDef | undefined {
  const norm = title.trim().replace(/\s+/g, ' ');
  return SECTIONS.find((s) => s.title.en === norm || s.title.it === norm);
}
