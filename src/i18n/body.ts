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
  // the word after the number of a chip, for a screen reader only ("Cuore 9 schede")
  unitOne: { it: 'scheda', en: 'card' },
  unitMany: { it: 'schede', en: 'cards' },
  countMany: { it: '{n} schede', en: '{n} cards' },

  // The stage (spec §5): names, help and messages. The script reads the messages from `data-t-*` attributes.
  stage: { it: 'Corpo umano in 3D', en: 'Human body in 3D' },
  controls: { it: 'Comandi del modello 3D', en: '3D model controls' },
  help: {
    it: 'Con il modello attivo: frecce per ruotare, più per avvicinare, meno per allontanare, 0 per ripristinare la vista, le parentesi quadre per cambiare organo, Esc per deselezionare.',
    en: 'With the model on: arrow keys rotate, plus zooms in, minus zooms out, 0 resets the view, the square brackets change organ, Esc clears the selection.',
  },
  load: { it: 'Esplora in 3D', en: 'Explore in 3D' },
  off: { it: 'Spegni il 3D', en: 'Turn 3D off' },
  left: { it: 'Ruota a sinistra', en: 'Rotate left' },
  right: { it: 'Ruota a destra', en: 'Rotate right' },
  up: { it: 'Ruota in alto', en: 'Rotate up' },
  down: { it: 'Ruota in basso', en: 'Rotate down' },
  in: { it: 'Avvicina', en: 'Zoom in' },
  out: { it: 'Allontana', en: 'Zoom out' },
  front: { it: 'Vista frontale', en: 'Front view' },
  back: { it: 'Vista posteriore', en: 'Back view' },
  side: { it: 'Vista laterale', en: 'Side view' },
  reset: { it: 'Ripristina la vista', en: 'Reset view' },
  // short visible names of the control row; the long names above are the aria-labels of the icon buttons
  frontShort: { it: 'Fronte', en: 'Front' },
  backShort: { it: 'Retro', en: 'Back' },
  sideShort: { it: 'Lato', en: 'Side' },
  resetShort: { it: 'Reset', en: 'Reset' },
  offShort: { it: 'Spegni 3D', en: '3D off' },
  close: { it: 'Chiudi', en: 'Close' },
  prev: { it: 'Organo precedente', en: 'Previous organ' },
  next: { it: 'Organo successivo', en: 'Next organ' },
  loading: { it: 'Caricamento del modello 3D…', en: 'Loading the 3D model…' },
  ready: { it: 'Modello 3D pronto.', en: '3D model ready.' },
  turnedOff: { it: 'Modello 3D spento.', en: '3D model turned off.' },
  error: { it: 'Impossibile caricare il modello 3D. Le schede restano qui sotto.', en: 'The 3D model could not be loaded. The cards stay below.' },
  lost: { it: 'Il 3D si è interrotto. Premi “Esplora in 3D” per riprovare.', en: 'The 3D view stopped. Press “Explore in 3D” to try again.' },
  noModel: { it: '{organ}: nessun modello 3D per ora.', en: '{organ}: no 3D model yet.' },
  whole: { it: 'Corpo intero', en: 'Whole body' },
  // {n} is the text of the organ's own count in the tree ("1 scheda", "3 schede"), already in the right number
  organ: { it: '{organ}: {n}', en: '{organ}: {n}' },
  system: { it: 'Apparato: {system}', en: 'System: {system}' },
  creditHra: {
    it: 'Organi femminili: HRA 3D Reference Object Library v2.5, CC BY 4.0, adattati al corpo di base e semplificati da questo progetto.',
    en: 'Female organs: HRA 3D Reference Object Library v2.5, CC BY 4.0, fitted into the base body and simplified by this project.',
  },
  creditChanges: {
    it: 'Modifiche: uniti, semplificati, ricolorati, spostati e ridimensionati.',
    en: 'Changes: merged, simplified, recoloured, moved and scaled.',
  },
  creditMore: { it: 'Licenze e crediti', en: 'Licenses and credits' },

  // One note per organ kind (spec §3); `mesh` has none.
  noteHra: {
    it: 'Modello adattato da un riferimento femminile; il corpo di base è maschile.',
    en: 'Fitted from a female reference model; the base body is male.',
  },
  noteProxy: { it: 'Nessun modello proprio: mostrato su {organs}.', en: 'No model of its own: shown on {organs}.' },
  noteSchematic: { it: 'Forma schematica, non una scansione.', en: 'Schematic shape, not a scan.' },
  noteNone: { it: 'Nessun modello 3D per ora.', en: 'No 3D model yet.' },

  // The body block of the home page
  homeHint: { it: 'Scegli un apparato per vedere i suoi organi.', en: 'Pick a system to see its organs.' },
  homeAll: { it: 'Tutte le schede per organo', en: 'All cards by organ' },

  // Closing section: cards that have no organ
  otherTitle: { it: 'Schede senza un organo', en: 'Cards without an organ' },
  otherBody: {
    it: 'Le schede di patologia generale e le condizioni sistemiche non hanno una sede nel corpo. Trovale per lente:',
    en: 'Cards of general pathology and systemic conditions have no site on the body. Find them by lens:',
  },
});
