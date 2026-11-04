import { defineStrings } from './index.ts';

/** Pathways (O9): step list, 2D diagram stepper and the <ap-structure> 3D viewer. */
export const tPw = defineStrings({
  kicker: { it: 'Percorso molecolare', en: 'Molecular pathway' },
  steps: { it: 'Passi', en: 'Steps' },
  diagram: { it: 'Schema del percorso', en: 'Pathway diagram' },
  diagramDesc: {
    it: 'Schema a blocchi: ogni riquadro è un passo dell’elenco, nello stesso ordine.',
    en: 'Block diagram: each box is a step of the list, in the same order.',
  },
  stepOf: { it: 'Passo {n} di {total}', en: 'Step {n} of {total}' },
  stepStatus: { it: 'Passo {n} di {total}: {title}', en: 'Step {n} of {total}: {title}' },
  prev: { it: 'Passo precedente', en: 'Previous step' },
  next: { it: 'Passo successivo', en: 'Next step' },
  openFull: { it: 'Apri il percorso completo', en: 'Open the full pathway' },
  onEntity: { it: 'Il percorso passo per passo', en: 'The pathway step by step' },
  sources: { it: 'Fonti', en: 'Sources' },
  reportThis: { it: 'Segnala un errore in questo percorso', en: 'Report an error in this pathway' },

  // 3D viewer
  view3d: { it: 'Vista 3D', en: '3D view' },
  load3d: { it: 'Carica la vista 3D (circa 160 kB)', en: 'Load the 3D view (about 160 kB)' },
  loading3d: { it: 'Caricamento della vista 3D…', en: 'Loading the 3D view…' },
  loaded3d: { it: 'Vista 3D pronta: {title}', en: '3D view ready: {title}' },
  no3d: {
    it: 'La vista 3D non è disponibile su questo dispositivo: restano l’immagine, lo schema e i passi.',
    en: 'The 3D view is not available on this device: the image, the diagram and the steps remain.',
  },
  noStructure: { it: 'Questo passo non ha una struttura 3D; resta quella precedente.', en: 'This step has no 3D structure; the previous one stays.' },
  stageHelp: {
    it: 'Modello 3D. Frecce: ruota; + e −: zoom; 0: vista iniziale.',
    en: '3D model. Arrow keys: rotate; + and −: zoom; 0: initial view.',
  },
  tools3d: { it: 'Comandi della vista 3D', en: '3D view controls' },
  rotateLeft: { it: 'Ruota a sinistra', en: 'Rotate left' },
  rotateRight: { it: 'Ruota a destra', en: 'Rotate right' },
  rotateUp: { it: 'Ruota in alto', en: 'Rotate up' },
  rotateDown: { it: 'Ruota in basso', en: 'Rotate down' },
  zoomIn: { it: 'Ingrandisci', en: 'Zoom in' },
  zoomOut: { it: 'Riduci', en: 'Zoom out' },
  reset: { it: 'Vista iniziale', en: 'Reset view' },
  labels: { it: 'Etichette', en: 'Labels' },
  poster: { it: 'Immagine statica della struttura {pdb}', en: 'Still image of structure {pdb}' },
  legendBase: { it: 'grigio: resto della struttura', en: 'grey: rest of the structure' },
  legendHighlight: { it: 'arancione: {label}', en: 'orange: {label}' },
  structureLine: { it: 'Struttura 3D: PDB {pdb}', en: '3D structure: PDB {pdb}' },
  method: { it: 'Metodo', en: 'Method' },
  resolution: { it: 'risoluzione', en: 'resolution' },
  organisms: { it: 'Organismi', en: 'Organisms' },
  note: { it: 'Nota', en: 'Note' },
  shows: { it: 'Contiene', en: 'Contains' },
  chains: { it: 'catene', en: 'chains' },
  citation: { it: 'Pubblicazione', en: 'Publication' },
  dataCredit: {
    it: 'Dati strutturali: RCSB PDB (CC0 1.0), visualizzati con 3Dmol.js.',
    en: 'Structure data: RCSB PDB (CC0 1.0), shown with 3Dmol.js.',
  },
});

/** RCSB experimental methods (`exptl.method`) in plain words. */
export const METHOD: Record<string, { it: string; en: string }> = {
  'X-RAY DIFFRACTION': { it: 'diffrazione di raggi X', en: 'X-ray diffraction' },
  'SOLUTION NMR': { it: 'NMR in soluzione', en: 'solution NMR' },
  'ELECTRON MICROSCOPY': { it: 'microscopia elettronica', en: 'electron microscopy' },
};
