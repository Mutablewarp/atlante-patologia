import { defineStrings } from './index.ts';

/** Home, Atlas, Study, Search and Me page strings. */
export const tHome = defineStrings({
  metaDescription: {
    it: 'Atlante di Patologia: atlante libero e bilingue di anatomia patologica con sistema di studio, per studenti di medicina.',
    en: 'Atlante di Patologia: a free, bilingual pathology atlas and study system for medical students.',
  },
  status: { it: 'Stato del progetto', en: 'Project status' },
  statusBody: {
    it: 'Fase 1: la struttura del sito è online. Il primo capitolo, Danno, adattamento e morte cellulare, è in scrittura e verifica: lo pubblichiamo solo quando ogni affermazione è controllata.',
    en: 'Phase 1: the structure of the site is live. The first chapter, Cell injury, adaptation and death, is being written and checked: it goes online only once every claim has been verified.',
  },
  startHere: { it: 'Da dove cominciare', en: 'Start here' },
  atlasCardTitle: { it: 'Sfoglia l’atlante', en: 'Browse the atlas' },
  atlasCardBody: {
    it: 'Ogni malattia si raggiunge da sei “lenti”: organo, processo, quadro morfologico, presentazione clinica, marcatore e gruppo.',
    en: 'Every disease can be reached through six “lenses”: organ, process, morphologic pattern, clinical presentation, marker and group.',
  },
  studyCardTitle: { it: 'Studia con metodo', en: 'Study with a method' },
  studyCardBody: {
    it: 'Ripasso a intervalli (FSRS), quiz con spiegazioni e allenamento sulle immagini, tutto salvato solo sul tuo dispositivo.',
    en: 'Spaced review (FSRS), quizzes with explanations and image training, all saved only on your device.',
  },
  progress: { it: 'Avanzamento dei capitoli', en: 'Chapter progress' },
  progressSummary: { it: '{published} di {total} capitoli pubblicati', en: '{published} of {total} chapters published' },
  seeRoadmap: { it: 'Vedi il piano completo', en: 'See the full roadmap' },
});

export const tAtlas = defineStrings({
  title: { it: 'Atlante', en: 'Atlas' },
  metaDescription: {
    it: 'Sfoglia l’atlante per organo, processo, quadro morfologico, presentazione, marcatore o gruppo di malattie.',
    en: 'Browse the atlas by organ, process, morphologic pattern, presentation, marker or disease group.',
  },
  intro: {
    it: 'Scegli una lente per entrare nell’atlante. Le stesse schede si ritrovano da più lenti: così si collegano gli argomenti tra loro.',
    en: 'Pick a lens to enter the atlas. The same cards appear under several lenses, which is how topics connect to each other.',
  },
  lenses: { it: 'Lenti', en: 'Lenses' },
  az: { it: 'A–Z', en: 'A–Z' },
  azTitle: { it: 'Indice A–Z', en: 'A–Z index' },
  azBody: {
    it: 'L’indice alfabetico di schede e glossario, in italiano e in inglese, con sinonimi ed eponimi.',
    en: 'The alphabetical index of cards and glossary terms, in Italian and English, with synonyms and eponyms.',
  },
  modules: { it: 'Capitoli', en: 'Chapters' },
  modulesIntro: {
    it: 'I capitoli seguono il programma del corso. Quelli “in preparazione” non hanno ancora pagine: il link porta al piano.',
    en: 'Chapters follow the course syllabus. “Planned” chapters have no pages yet: the link goes to the roadmap.',
  },
  termCount: { it: '{n} schede', en: '{n} cards' },
  termCountOne: { it: '1 scheda', en: '1 card' },
  termsInLens: { it: 'Voci di questa lente', en: 'Terms in this lens' },
  emptyLens: {
    it: 'Nessuna scheda è ancora pubblicata in questa lente. Le voci compaiono come link appena il primo capitolo esce.',
    en: 'No card is published under this lens yet. Terms become links as soon as the first chapter is out.',
  },
  emptyAz: {
    it: 'L’indice si riempie con il primo capitolo pubblicato.',
    en: 'The index fills up with the first published chapter.',
  },
  entitiesForTerm: { it: 'Schede', en: 'Cards' },
  prevTerm: { it: 'Voce precedente', en: 'Previous term' },
  nextTerm: { it: 'Voce successiva', en: 'Next term' },
});

export const tStudy = defineStrings({
  title: { it: 'Studio', en: 'Study' },
  metaDescription: {
    it: 'Gli strumenti di studio dell’atlante: ripasso a intervalli, quiz, allenamento sulle immagini e pianificazione.',
    en: 'The atlas study tools: spaced review, quizzes, image training and planning.',
  },
  intro: {
    it: 'Gli strumenti di studio si attivano con il primo capitolo pubblicato. Ecco cosa arriverà e come funzionerà.',
    en: 'The study tools switch on with the first published chapter. Here is what is coming and how it will work.',
  },
  availableWhen: { it: 'Disponibile con il primo capitolo', en: 'Available with the first chapter' },
  reviewTitle: { it: 'Ripasso a intervalli', en: 'Spaced review' },
  reviewBody: {
    it: 'Schede generate dai punti chiave, ripianificate con l’algoritmo FSRS: ripassi ciò che stai per dimenticare.',
    en: 'Cards generated from the high-yield points, rescheduled with the FSRS algorithm: you review what you are about to forget.',
  },
  quizTitle: { it: 'Quiz', en: 'Quizzes' },
  quizBody: {
    it: 'Domande a scelta multipla con casi clinici originali, per argomento, miste, a tempo o sui tuoi punti deboli. Ogni risposta spiega il perché.',
    en: 'Multiple-choice questions with original clinical vignettes: by topic, mixed, timed or on your weak spots. Every answer explains why.',
  },
  imagesTitle: { it: 'Allenamento sulle immagini', en: 'Image training' },
  imagesBody: {
    it: 'Riconosci la diagnosi, abbina macroscopia e istologia, distingui i quadri che si somigliano.',
    en: 'Spot the diagnosis, pair gross and microscopic images, tell look-alikes apart.',
  },
  chainTitle: { it: 'Catena patologia → segno → esame', en: 'Pathology → sign → test chain' },
  chainBody: {
    it: 'Collega la lesione al segno clinico e all’esame che la conferma.',
    en: 'Link the lesion to the clinical sign and the test that confirms it.',
  },
  plannerTitle: { it: 'Pianificatore', en: 'Planner' },
  plannerBody: {
    it: 'Data dell’esame e ore settimanali: ricevi un calendario di studio e ripasso.',
    en: 'Exam date and weekly hours in, a study and review schedule out.',
  },
  lastWeekTitle: { it: 'Ripasso dell’ultima settimana', en: 'Last-week revision' },
  lastWeekBody: {
    it: 'Una sessione compatta prima dell’esame: punti chiave, trappole e diagnosi differenziali.',
    en: 'A compact session before the exam: high-yield points, traps and differentials.',
  },
});

export const tSearch = defineStrings({
  title: { it: 'Cerca', en: 'Search' },
  metaDescription: {
    it: 'Cerca nell’atlante in italiano o in inglese, anche per sinonimi ed eponimi.',
    en: 'Search the atlas in Italian or English, including synonyms and eponyms.',
  },
  intro: {
    it: 'La ricerca funziona nel tuo browser e non invia nulla a terzi. Le schede riportano i nomi in italiano e in inglese, quindi puoi cercare in entrambe le lingue.',
    en: 'Search runs in your browser and sends nothing to third parties. Cards list their names in English and Italian, so you can search in either language.',
  },
  noJs: {
    it: 'La ricerca richiede JavaScript. Puoi comunque sfogliare l’atlante per lenti.',
    en: 'Search needs JavaScript. You can still browse the atlas by lens.',
  },
  results: { it: '{n} risultati per “{q}”', en: '{n} results for “{q}”' },
  noResults: { it: 'Nessun risultato per “{q}”.', en: 'No results for “{q}”.' },
  loading: { it: 'Ricerca in corso…', en: 'Searching…' },
  unavailable: {
    it: 'L’indice di ricerca non è disponibile in questa anteprima (viene creato con la build completa).',
    en: 'The search index is not available in this preview (it is created by the full build).',
  },
});

export const tMe = defineStrings({
  title: { it: 'Profilo', en: 'Me' },
  metaDescription: {
    it: 'Il tuo spazio di studio: progressi, segnalibri, note ed errori, salvati solo sul tuo dispositivo.',
    en: 'Your study space: progress, bookmarks, notes and mistakes, saved only on your device.',
  },
  intro: {
    it: 'Qui troverai i tuoi progressi, i segnalibri, le note e gli errori da ripassare. Non ci sono account: tutto resta nel browser di questo dispositivo.',
    en: 'This is where your progress, bookmarks, notes and mistakes to review will appear. There are no accounts: everything stays in this device’s browser.',
  },
  emptyTitle: { it: 'Ancora nessun dato', en: 'No data yet' },
  emptyBody: {
    it: 'Quando inizierai a ripassare o a fare quiz, qui comparirà un riepilogo onesto: copertura, padronanza, ripassi in arretrato e punti deboli.',
    en: 'Once you start reviewing or taking quizzes, an honest summary appears here: coverage, mastery, review backlog and weak spots.',
  },
  dataTitle: { it: 'I tuoi dati', en: 'Your data' },
  dataBody: {
    it: 'Potrai esportare e importare i tuoi dati in un file, e vedere quanto spazio occupano. Cancellare i dati del sito dal browser li elimina definitivamente.',
    en: 'You will be able to export and import your data as a file and see how much space it uses. Clearing site data in the browser deletes it for good.',
  },
});

export const tEntity = defineStrings({
  names: { it: 'Altri nomi', en: 'Other names' },
  latin: { it: 'Latino', en: 'Latin' },
  eponyms: { it: 'Eponimi', en: 'Eponyms' },
  synonyms: { it: 'Sinonimi', en: 'Synonyms' },
  abbreviations: { it: 'Sigle', en: 'Abbreviations' },
  lensTags: { it: 'Lenti', en: 'Lenses' },
  reviewUnreviewed: { it: 'Generato con IA, non ancora revisionato', en: 'AI-generated, not yet reviewed' },
  reviewExpert: { it: 'Revisionato da un esperto', en: 'Expert-reviewed' },
  updated: { it: 'Aggiornato il {date}', en: 'Updated {date}' },
  editionDependent: { it: 'Dipende dall’edizione', en: 'Edition-dependent' },
  draftBanner: {
    it: 'BOZZA DI PROVA — testo segnaposto, visibile solo in anteprima locale.',
    en: 'TEST DRAFT — placeholder text, visible only in local preview.',
  },
  mode: { it: 'Modalità di lettura', en: 'Reading mode' },
  quick: { it: 'Rapida', en: 'Quick' },
  full: { it: 'Completa', en: 'Full' },
  expandAll: { it: 'Espandi tutto', en: 'Expand all' },
  collapseAll: { it: 'Comprimi tutto', en: 'Collapse all' },
  print: { it: 'Stampa il riassunto', en: 'Print summary' },
  onThisPage: { it: 'In questa pagina', en: 'On this page' },
  objectives: { it: 'Obiettivi di apprendimento', en: 'Learning objectives' },
  showAnswer: { it: 'Mostra la risposta', en: 'Show answer' },
  related: { it: 'Collegamenti', en: 'Related' },
  notPublished: { it: 'non ancora pubblicato', en: 'not yet published' },
  prevIn: { it: 'Precedente in “{term}”', en: 'Previous in “{term}”' },
  nextIn: { it: 'Successivo in “{term}”', en: 'Next in “{term}”' },
  sources: { it: 'Fonti', en: 'Sources' },
  reportThis: { it: 'Segnala un errore in questa scheda', en: 'Report an error on this card' },
});
