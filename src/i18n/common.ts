import { defineStrings } from './index.ts';

export const SITE_NAME = 'Atlante di Patologia';
export const ISSUES_URL = 'https://github.com/Mutablewarp/atlante-patologia/issues';
export const REPO_URL = 'https://github.com/Mutablewarp/atlante-patologia';

export const tCommon = defineStrings({
  tagline: {
    it: 'Atlante di anatomia patologica libero e bilingue per chi studia medicina. Dopo la prima visita la home si apre anche senza connessione, e i capitoli si possono scaricare per studiarli offline.',
    en: 'A free, bilingual pathology atlas for medical students. After your first visit the home page opens without a connection too, and chapters can be downloaded to study offline.',
  },
  skipToContent: { it: 'Vai al contenuto', en: 'Skip to content' },
  language: { it: 'Lingua', en: 'Language' },
  switchToOther: { it: 'Read this page in English', en: 'Leggi questa pagina in italiano' },
  // Spoken in the target language (the link carries lang="en"/"it").
  switchToOtherHome: { it: 'Go to the English home page', en: 'Vai alla home page in italiano' },
  theme: { it: 'Tema', en: 'Theme' },
  themeSystem: { it: 'Automatico', en: 'Automatic' },
  themeLight: { it: 'Chiaro', en: 'Light' },
  themeDark: { it: 'Scuro', en: 'Dark' },
  themeButton: { it: 'Tema: {mode}. Cambia', en: 'Theme: {mode}. Change' },
  planned: { it: 'In preparazione', en: 'Planned' },
  published: { it: 'Pubblicato', en: 'Published' },
  draft: { it: 'Bozza', en: 'Draft' },
  roadmap: { it: 'Piano dei capitoli', en: 'Roadmap' },
  breadcrumb: { it: 'Percorso', en: 'Breadcrumb' },
  sectionI: { it: 'I. Patologia generale', en: 'I. General pathology' },
  sectionII: { it: 'II. Condizioni sistemiche', en: 'II. Systemic conditions' },
  sectionIII: { it: 'III. Patologia d’organo', en: 'III. Organ systems' },
  // Footer + disclaimer (COMPLIANCE_PLAN §2 item 6)
  disclaimerShort: {
    it: 'Solo a scopo didattico: non usare per diagnosi o decisioni terapeutiche. Può contenere errori.',
    en: 'For education only: not for diagnosis or treatment decisions. It may contain errors.',
  },
  // EU AI Act art. 50(4): one disclosure line on every page (owner decision O11)
  aiNotice: {
    it: 'Testi generati con l’IA e controllati automaticamente sulle fonti citate; nessun esperto li ha ancora rivisti: possono contenere errori.',
    en: 'Texts generated with AI and checked automatically against the cited sources; no expert has reviewed them yet, so they may contain errors.',
  },
  aiNoticeLink: { it: 'Come nascono i contenuti', en: 'How the content is made' },
  // Reading size (A-/A+)
  textSize: { it: 'Dimensione del testo', en: 'Text size' },
  textSmaller: { it: 'Testo più piccolo', en: 'Smaller text' },
  textLarger: { it: 'Testo più grande', en: 'Larger text' },
  textSizeNow: { it: 'Dimensione del testo: {n} di {total}', en: 'Text size: {n} of {total}' },
  reportError: { it: 'Segnala un errore', en: 'Report an error' },
  footerAbout: { it: 'Informazioni', en: 'About' },
  footerMethod: { it: 'Metodo', en: 'Method' },
  footerPrivacy: { it: 'Privacy', en: 'Privacy' },
  footerDisclaimer: { it: 'Avvertenza medica', en: 'Medical disclaimer' },
  footerAccessibility: { it: 'Accessibilità', en: 'Accessibility' },
  footerLicenses: { it: 'Licenze', en: 'Licenses' },
  footerCredits: { it: 'Crediti', en: 'Credits' },
  footerLicenseLine: {
    it: 'Codice MIT · Contenuti CC BY-SA 4.0 · Nessun cookie, nessun tracciamento.',
    en: 'Code MIT · Content CC BY-SA 4.0 · No cookies, no tracking.',
  },
  noticeTitle: { it: 'Prima di iniziare', en: 'Before you start' },
  noticeBody: {
    it: 'Questo atlante serve a studiare. Non è uno strumento clinico: non usarlo per fare diagnosi o per decidere terapie. I contenuti sono generati con l’IA e controllati automaticamente con un processo documentato; nessun esperto li ha ancora rivisti: possono contenere errori.',
    en: 'This atlas is for studying. It is not a clinical tool: do not use it for diagnosis or to decide treatment. The content is generated with AI and checked automatically with a documented process; no expert has reviewed it yet, so it may contain errors.',
  },
  noticeMore: { it: 'Leggi l’avvertenza completa', en: 'Read the full disclaimer' },
  noticeDismiss: { it: 'Ho capito', en: 'I understand' },
  newTab: { it: '(apre GitHub)', en: '(opens GitHub)' },
  empty: { it: 'Ancora nulla qui', en: 'Nothing here yet' },
  // 404
  notFoundTitle: { it: 'Pagina non trovata', en: 'Page not found' },
  notFoundBody: {
    it: 'Questo indirizzo non esiste o non è ancora stato pubblicato. Prova a cercare, oppure riparti da qui:',
    en: 'This address does not exist or has not been published yet. Try a search, or start again from here:',
  },
});
