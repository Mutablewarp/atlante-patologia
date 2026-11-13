import { defineStrings } from './index.ts';

/** Interactive body page (docs/BODY_SPEC.md §3 and §5): the tree of systems, organs and cards. */
export const tBody = defineStrings({
  title: { it: 'Il corpo', en: 'The body' },
  intro: {
    it: 'Scegli un apparato e un organo: sotto trovi le schede che lo riguardano, raggruppate per processo e nell’ordine del programma.',
    en: 'Pick a system and an organ: below it are the cards that concern it, grouped by process and in syllabus order.',
  },
  chips: { it: 'Apparati', en: 'Systems' },
  planned: { it: 'Schede pianificate', en: 'Planned cards' },
  plannedBadge: { it: 'pianificata', en: 'planned' },
  noCard: { it: 'Nessuna scheda per ora.', en: 'No card yet.' },
  countOne: { it: '1 scheda', en: '1 card' },
  countMany: { it: '{n} schede', en: '{n} cards' },

  // One note per organ kind (spec §3); `mesh` has none.
  noteHra: {
    it: 'Modello adattato da un riferimento femminile; il corpo di base è maschile.',
    en: 'Fitted from a female reference model; the base body is male.',
  },
  noteProxy: { it: 'Nessun modello proprio: mostrato su {organs}.', en: 'No model of its own: shown on {organs}.' },
  noteSchematic: { it: 'Forma schematica, non una scansione.', en: 'Schematic shape, not a scan.' },
  noteNone: { it: 'Nessun modello 3D per ora.', en: 'No 3D model yet.' },

  // Closing section: cards that have no organ
  otherTitle: { it: 'Schede senza un organo', en: 'Cards without an organ' },
  otherBody: {
    it: 'Le schede di patologia generale e le condizioni sistemiche non hanno una sede nel corpo. Trovale per lente:',
    en: 'Cards of general pathology and systemic conditions have no site on the body. Find them by lens:',
  },
});
