import type { L } from './index.ts';

/** About section: page titles and one-line descriptions (prose lives in the pages). */
export const ABOUT_PAGES = {
  method: {
    title: { it: 'Come nascono i contenuti', en: 'How the content is made' },
    description: {
      it: 'Metodo, verifica delle affermazioni, uso dell’intelligenza artificiale, stato di revisione e limiti.',
      en: 'Method, claim checking, use of artificial intelligence, review status and limits.',
    },
  },
  disclaimer: {
    title: { it: 'Avvertenza medica', en: 'Medical disclaimer' },
    description: {
      it: 'Uso esclusivamente didattico: l’atlante non è uno strumento per diagnosi o terapia.',
      en: 'For education only: the atlas is not a tool for diagnosis or treatment.',
    },
  },
  privacy: {
    title: { it: 'Privacy', en: 'Privacy' },
    description: {
      it: 'Niente account, cookie o analisi del traffico: i tuoi dati di studio restano nel browser.',
      en: 'No accounts, cookies or analytics: your study data stays in your browser.',
    },
  },
  accessibility: {
    title: { it: 'Accessibilità', en: 'Accessibility' },
    description: {
      it: 'Obiettivo WCAG 2.2 livello AA: come lo verifichiamo, limiti noti e come segnalare problemi.',
      en: 'Target WCAG 2.2 level AA: how we test it, known limits and how to report problems.',
    },
  },
  roadmap: {
    title: { it: 'Piano dei capitoli', en: 'Roadmap' },
    description: {
      it: 'Tutti i capitoli previsti, nell’ordine del programma, con il loro stato.',
      en: 'Every planned chapter, in syllabus order, with its status.',
    },
  },
  'reading-list': {
    title: { it: 'Letture consigliate', en: 'Reading list' },
    description: {
      it: 'Il testo di riferimento e gli studi sul metodo di studio citati dal progetto.',
      en: 'The reference textbook and the studies on learning methods cited by the project.',
    },
  },
  credits: {
    title: { it: 'Crediti', en: 'Credits' },
    description: {
      it: 'Autori e licenze di immagini e caratteri tipografici.',
      en: 'Authors and licences of images and typefaces.',
    },
  },
  licenses: {
    title: { it: 'Licenze', en: 'Licenses' },
    description: {
      it: 'Codice MIT, contenuti CC BY-SA 4.0, immagini di terzi con la propria licenza.',
      en: 'Code MIT, content CC BY-SA 4.0, third-party images under their own licences.',
    },
  },
  report: {
    title: { it: 'Segnala un errore', en: 'Report an error' },
    description: {
      it: 'Come segnalare errori nei contenuti, problemi di accessibilità o richieste di rimozione.',
      en: 'How to report content errors, accessibility problems or takedown requests.',
    },
  },
} as const satisfies Record<string, { title: L; description: L }>;

export type AboutSlug = keyof typeof ABOUT_PAGES;

export const ABOUT_INDEX = {
  title: { it: 'Informazioni', en: 'About' },
  description: {
    it: 'Che cos’è l’Atlante di Patologia, come è fatto, privacy, licenze e avvertenze.',
    en: 'What Atlante di Patologia is, how it is made, privacy, licences and disclaimers.',
  },
} as const;
