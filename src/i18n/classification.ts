import { defineStrings } from './index.ts';

/** Entity classification line and "newer edition" notice (ClassificationNote.astro). */
export const tClass = defineStrings({
  label: { it: 'Classificazione', en: 'Classification' },
  volume: { it: 'Vol. {n}', en: 'Vol. {n}' },
  checked: { it: 'verificata il {date}', en: 'checked on {date}' },
  print: { it: 'a stampa', en: 'in print' },
  'online-beta': { it: 'beta online', en: 'online beta' },
  forthcoming: { it: 'in preparazione', en: 'forthcoming' },
  superseded: { it: 'sostituita', en: 'superseded' },
  newer: {
    it: 'È disponibile un’edizione più recente: {edition}, {status}, {year}. Questa scheda non è ancora stata ricontrollata su di essa.',
    en: 'A newer edition is available: {edition}, {status}, {year}. This card has not yet been re-checked against it.',
  },
});
