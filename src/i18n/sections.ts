/**
 * The 13 fixed entity sections (CONTENT_SCHEMA §1b) plus the rendered Quick check.
 * Anchor ids are language-neutral, so `#micro` works in both languages.
 * The H2 titles in `it.md` / `en.md` must match these strings exactly.
 */
import type { L } from './index.ts';

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

/** Sections shown in the printed one-page summary. */
export const PRINT_SECTIONS = ['high-yield', 'differential', 'traps'] as const;

/** Map a localized H2 title (either language) to its anchor id. */
export function sectionIdForTitle(title: string): SectionDef | undefined {
  const norm = title.trim().replace(/\s+/g, ' ');
  return SECTIONS.find((s) => s.title.en === norm || s.title.it === norm);
}
