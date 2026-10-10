import { defineStrings } from './index.ts';

/** Study engine and personal layer: hub, review, quiz, images, chain, planner, Me, data, entity actions. */
export const tS = defineStrings({
  // ── Shared ────────────────────────────────────────────────────────────
  loading: { it: 'Caricamento…', en: 'Loading…' },
  noJs: {
    it: 'Questo strumento funziona nel browser e richiede JavaScript. I contenuti dell’atlante restano leggibili senza.',
    en: 'This tool runs in your browser and needs JavaScript. The atlas itself stays readable without it.',
  },
  storageError: {
    it: 'Il browser non permette di salvare dati (forse sei in navigazione privata). Puoi usare lo strumento, ma i progressi non verranno ricordati.',
    en: 'Your browser does not allow saving data (private browsing?). You can use the tool, but progress will not be remembered.',
  },
  noContent: {
    it: 'Non ci sono ancora contenuti pubblicati per questo strumento. Si attiva con il primo capitolo.',
    en: 'There is no published content for this tool yet. It switches on with the first chapter.',
  },
  allModules: { it: 'Tutti i capitoli', en: 'All chapters' },
  module: { it: 'Capitolo', en: 'Chapter' },
  start: { it: 'Inizia', en: 'Start' },
  restart: { it: 'Ricomincia', en: 'Start again' },
  next: { it: 'Avanti', en: 'Next' },
  finish: { it: 'Termina', en: 'Finish' },
  back: { it: 'Torna allo studio', en: 'Back to Study' },
  reviewThis: { it: 'Ripassa nella scheda', en: 'Review it in the card' },
  correct: { it: 'Corretto', en: 'Correct' },
  wrong: { it: 'Sbagliato', en: 'Incorrect' },
  minutes: { it: '{n} min', en: '{n} min' },
  hours: { it: '{n} h', en: '{n} h' },
  days: { it: '{n} g', en: '{n} d' },
  months: { it: '{n} mesi', en: '{n} mo' },
  save: { it: 'Salva', en: 'Save' },
  saved: { it: 'Salvato', en: 'Saved' },
  delete: { it: 'Elimina', en: 'Delete' },
  draftNote: {
    it: 'Anteprima locale: le domande e le schede di prova sono segnaposto senza contenuto medico.',
    en: 'Local preview: test questions and cards are placeholders with no medical content.',
  },

  // ── Study hub ─────────────────────────────────────────────────────────
  hubIntro: {
    it: 'Ripasso a intervalli, quiz, immagini e pianificazione. Tutto funziona nel browser e i progressi restano su questo dispositivo.',
    en: 'Spaced review, quizzes, images and planning. Everything runs in your browser and your progress stays on this device.',
  },
  hubDue: { it: 'Da ripassare oggi: {n}', en: 'Due today: {n}' },
  hubNothingDue: { it: 'Nessun ripasso in scadenza oggi.', en: 'No reviews due today.' },
  open: { it: 'Apri', en: 'Open' },
  evidenceLink: { it: 'Perché questo metodo: cosa dicono gli studi', en: 'Why this method: what the research says' },
  lastWeekCta: { it: 'Apri la revisione dei punti chiave', en: 'Open the high-yield revision' },

  // ── Review ────────────────────────────────────────────────────────────
  reviewTitle: { it: 'Ripasso a intervalli', en: 'Spaced review' },
  reviewIntro: {
    it: 'Prova a ricordare, poi scopri la risposta e valuta quanto è stato facile. L’algoritmo FSRS sceglie quando riproportela.',
    en: 'Try to recall, then reveal the answer and rate how it went. The FSRS algorithm decides when to show it again.',
  },
  scope: { it: 'Cosa ripassare', en: 'What to review' },
  newPerDay: { it: 'Schede nuove al giorno', en: 'New cards per day' },
  queueSummary: { it: '{due} da ripassare · {new} nuove', en: '{due} due · {new} new' },
  cardOf: { it: 'Scheda {i} di {n}', en: 'Card {i} of {n}' },
  reveal: { it: 'Mostra la risposta', en: 'Show answer' },
  revealKey: { it: 'Spazio', en: 'Space' },
  rateLabel: { it: 'Quanto è stato facile ricordarla?', en: 'How easy was it to recall?' },
  again: { it: 'Di nuovo', en: 'Again' },
  hard: { it: 'Difficile', en: 'Hard' },
  good: { it: 'Bene', en: 'Good' },
  easy: { it: 'Facile', en: 'Easy' },
  nextIn: { it: 'tra {t}', en: 'in {t}' },
  shortcuts: {
    it: 'Tastiera: Spazio mostra la risposta, 1–4 per valutare.',
    en: 'Keyboard: Space shows the answer, 1–4 to rate.',
  },
  doneTitle: { it: 'Per oggi hai finito', en: 'You are done for today' },
  doneBody: {
    it: 'Hai ripassato {n} schede. Le prossime compaiono quando è il momento giusto per ricordarle.',
    en: 'You reviewed {n} cards. The next ones appear when it is the right time to recall them.',
  },
  emptyQueue: {
    it: 'Nessuna scheda da ripassare ora. Aggiungi schede da una pagina dell’atlante o aumenta le schede nuove al giorno.',
    en: 'Nothing to review right now. Add cards from an atlas page or raise the number of new cards per day.',
  },
  cram: { it: 'Revisione dei punti chiave (non cambia la pianificazione)', en: 'High-yield revision (does not change scheduling)' },
  cramIntro: {
    it: 'Modalità ultima settimana: scorri tutti i punti chiave del capitolo. Le valutazioni qui non vengono salvate.',
    en: 'Last-week mode: go through every high-yield point of the chapter. Ratings here are not saved.',
  },
  kindCloze: { it: 'Completa', en: 'Fill the gap' },
  kindQa: { it: 'Domanda', en: 'Question' },
  kindOcclusion: { it: 'Immagine', en: 'Image' },
  occlusionPrompt: { it: 'Che cosa indica l’area evidenziata?', en: 'What does the highlighted area show?' },
  forgetThis: { it: 'Continuo a dimenticarla', en: 'I keep forgetting this' },
  addedToErrors: { it: 'Aggiunta al registro errori', en: 'Added to your error log' },

  // ── Quiz ──────────────────────────────────────────────────────────────
  quizTitle: { it: 'Quiz', en: 'Quiz' },
  quizIntro: {
    it: 'Domande con spiegazione per ogni opzione e un link alla sezione della scheda da ripassare.',
    en: 'Questions with an explanation for every option and a link to the card section to review.',
  },
  mode: { it: 'Modalità', en: 'Mode' },
  modeTopic: { it: 'Per argomento', en: 'By topic' },
  modeMixed: { it: 'Misto (alternato)', en: 'Mixed (interleaved)' },
  modeExam: { it: 'Esame a tempo', en: 'Timed exam' },
  modeWeak: { it: 'Solo punti deboli', en: 'Weak areas only' },
  modeTopicHelp: { it: 'Un capitolo, o una sola scheda.', en: 'One chapter, or a single card.' },
  modeMixedHelp: {
    it: 'Domande di argomenti diversi alternate: più faticoso, ma aiuta a distinguere.',
    en: 'Questions from different topics, alternated: harder, but it helps you tell things apart.',
  },
  modeExamHelp: {
    it: 'Tempo limitato, spiegazioni alla fine. Puoi mettere in pausa e aggiungere tempo.',
    en: 'Time limit, explanations at the end. You can pause and add time.',
  },
  modeWeakHelp: {
    it: 'Le domande sbagliate l’ultima volta e quelle sugli argomenti sotto il 70 % di risposte giuste.',
    en: 'Questions you got wrong last time and those on topics under 70 % correct.',
  },
  entityFilter: { it: 'Solo la scheda: {name}', en: 'Only the card: {name}' },
  freeRecall: { it: 'Richiamo libero: rispondi prima di vedere le opzioni', en: 'Free recall: answer before seeing the options' },
  count: { it: 'Numero di domande', en: 'Number of questions' },
  minutesPerQ: { it: 'Minuti a domanda', en: 'Minutes per question' },
  questionOf: { it: 'Domanda {i} di {n}', en: 'Question {i} of {n}' },
  yourAnswer: { it: 'La tua risposta (facoltativa, solo per te)', en: 'Your answer (optional, only for you)' },
  showOptions: { it: 'Mostra le opzioni', en: 'Show options' },
  showModel: { it: 'Mostra la risposta modello', en: 'Show model answer' },
  modelAnswer: { it: 'Risposta modello', en: 'Model answer' },
  selfGrade: { it: 'Com’è andata?', en: 'How did you do?' },
  gradeRight: { it: 'Giusta', en: 'Got it' },
  gradePartial: { it: 'In parte', en: 'Partly' },
  gradeWrong: { it: 'Sbagliata', en: 'Missed it' },
  check: { it: 'Conferma', en: 'Check' },
  whyRight: { it: 'Perché è giusta', en: 'Why it is right' },
  whyWrong: { it: 'Perché no', en: 'Why not' },
  yourChoice: { it: 'la tua scelta', en: 'your choice' },
  timeLeft: { it: 'Tempo rimasto: {t}', en: 'Time left: {t}' },
  pause: { it: 'Pausa', en: 'Pause' },
  resume: { it: 'Riprendi', en: 'Resume' },
  paused: { it: 'In pausa: il tempo è fermo e le domande sono nascoste.', en: 'Paused: the clock is stopped and questions are hidden.' },
  addTime: { it: 'Aggiungi 5 minuti', en: 'Add 5 minutes' },
  timeUp: { it: 'Tempo scaduto. Ecco le spiegazioni.', en: 'Time is up. Here are the explanations.' },
  score: { it: '{right} giuste su {total}', en: '{right} correct out of {total}' },
  scoreNote: {
    it: 'Un punteggio su poche domande dice poco: usalo per capire cosa ripassare, non come previsione del voto.',
    en: 'A score on a few questions says little: use it to see what to review, not as a prediction of your grade.',
  },
  noWeak: {
    it: 'Nessun punto debole registrato: fai prima qualche quiz per argomento.',
    en: 'No weak areas recorded yet: take a few topic quizzes first.',
  },
  noQuestions: { it: 'Nessuna domanda disponibile per questa scelta.', en: 'No questions available for this choice.' },
  results: { it: 'Risultati', en: 'Results' },

  // ── Images ────────────────────────────────────────────────────────────
  imagesTitle: { it: 'Allenamento sulle immagini', en: 'Image training' },
  imagesIntro: {
    it: 'Riconosci la diagnosi, abbina macroscopia e istologia, distingui i quadri che si somigliano.',
    en: 'Spot the diagnosis, pair gross and microscopic images, tell look-alikes apart.',
  },
  spotTitle: { it: 'Riconosci la diagnosi', en: 'Spot the diagnosis' },
  pairsTitle: { it: 'Macroscopia e istologia', en: 'Gross and micro pairs' },
  pairsPrompt: {
    it: 'Quale immagine istologica appartiene alla stessa lesione?',
    en: 'Which microscopic image belongs to the same lesion?',
  },
  lookTitle: { it: 'Quadri che si somigliano', en: 'Look-alikes' },
  lookPrompt: { it: 'Quale delle due diagnosi mostra questa immagine?', en: 'Which of the two diagnoses does this image show?' },
  noImages: {
    it: 'Ancora nessuna immagine pubblicata per questo esercizio.',
    en: 'No published images for this exercise yet.',
  },
  choice: { it: 'Scelta {n}', en: 'Choice {n}' },

  // ── Chain ─────────────────────────────────────────────────────────────
  chainTitle: { it: 'Catena patologia → segno → esame', en: 'Pathology → sign → test chain' },
  chainIntro: {
    it: 'Parti dalla lesione: scegli il segno clinico che produce, poi l’esame che lo mette in evidenza.',
    en: 'Start from the lesion: pick the clinical sign it produces, then the test that shows it.',
  },
  chainPathology: { it: 'Patologia', en: 'Pathology' },
  chainSign: { it: 'Quale segno ne deriva?', en: 'Which sign follows?' },
  chainLab: { it: 'Quale esame lo conferma?', en: 'Which test confirms it?' },
  chainDone: { it: 'Catena completata: {right} passaggi giusti su {total}.', en: 'Chain complete: {right} of {total} steps right.' },

  // ── Planner ───────────────────────────────────────────────────────────
  plannerTitle: { it: 'Pianificatore', en: 'Planner' },
  plannerIntro: {
    it: 'Indica la data dell’esame e le ore che puoi dedicare ogni settimana. Il piano mette prima la patologia generale, dà più tempo ai tuoi punti deboli e riserva sempre tempo al ripasso.',
    en: 'Enter your exam date and the hours you can study each week. The plan puts general pathology first, gives more time to your weak areas and always keeps time for review.',
  },
  examDate: { it: 'Data dell’esame', en: 'Exam date' },
  hoursPerWeek: { it: 'Ore di studio a settimana', en: 'Study hours per week' },
  makePlan: { it: 'Crea il piano', en: 'Make the plan' },
  planInvalid: { it: 'Scegli una data futura e un numero di ore maggiore di zero.', en: 'Pick a future date and more than zero hours.' },
  week: { it: 'Settimana dal {from} al {to}', en: 'Week of {from} to {to}' },
  revisionWeek: { it: 'Ultima settimana: solo revisione ({from} – {to})', en: 'Last week: revision only ({from} – {to})' },
  reviewSlot: { it: 'Ripasso: {t}', en: 'Review: {t}' },
  revisionBody: {
    it: 'Niente argomenti nuovi: punti chiave, trappole e diagnosi differenziali, più i ripassi in scadenza.',
    en: 'No new topics: high-yield points, traps and differentials, plus the reviews that fall due.',
  },
  planShortfall: {
    it: 'Il tempo non basta per tutto: mancano circa {t}. Dai la precedenza alle schede “core” o aumenta le ore.',
    en: 'There is not enough time for everything: about {t} short. Prioritise “core” cards or add hours.',
  },
  planEstimate: {
    it: 'Stima grezza: circa {n} minuti per scheda, più tempo per i capitoli in cui sbagli di più.',
    en: 'Rough estimate: about {n} minutes per card, more for chapters where you make more mistakes.',
  },
  weakTag: { it: 'punto debole', en: 'weak area' },

  // ── Me dashboard ──────────────────────────────────────────────────────
  meIntro: {
    it: 'Numeri onesti, calcolati solo da ciò che hai fatto su questo dispositivo.',
    en: 'Honest numbers, computed only from what you did on this device.',
  },
  coverage: { it: 'Copertura', en: 'Coverage' },
  coverageBody: { it: '{read} schede lette su {total} pubblicate', en: '{read} of {total} published cards read' },
  mastery: { it: 'Padronanza', en: 'Mastery' },
  masteryBody: {
    it: '{mastered} flashcard consolidate su {total} (ricordo stimato per almeno 3 settimane)',
    en: '{mastered} of {total} flashcards mature (expected recall for 3+ weeks)',
  },
  debt: { it: 'Ripassi in arretrato', en: 'Review backlog' },
  debtBody: { it: '{n} schede da ripassare entro oggi', en: '{n} cards due by today' },
  weakSpots: { it: 'Punti deboli', en: 'Weak spots' },
  weakEmpty: { it: 'Nessun punto debole registrato finora.', en: 'No weak spots recorded so far.' },
  weakReason: { it: '{right}/{total} giuste nei quiz · {lapses} dimenticanze', en: '{right}/{total} right in quizzes · {lapses} lapses' },
  byModule: { it: 'Per capitolo', en: 'By chapter' },
  meEmpty: {
    it: 'Ancora nessun dato. Apri una scheda dell’atlante, ripassa o fai un quiz: il riepilogo comparirà qui.',
    en: 'No data yet. Open an atlas card, review or take a quiz: your summary will appear here.',
  },
  personal: { it: 'Le tue raccolte', en: 'Your collections' },
  bookmarks: { it: 'Segnalibri', en: 'Bookmarks' },
  notes: { it: 'Note ed evidenziazioni', en: 'Notes and highlights' },
  errors: { it: 'Registro errori', en: 'Error log' },
  data: { it: 'Dati e backup', en: 'Data and backup' },
  recent: { it: 'Visti di recente', en: 'Recently viewed' },
  recentEmpty: { it: 'Le schede che apri compariranno qui.', en: 'Cards you open will appear here.' },
  resumeTitle: { it: 'Riprendi da dove eri rimasto', en: 'Resume where you left off' },
  resumeEmpty: { it: 'Apri una scheda per iniziare.', en: 'Open a card to begin.' },
  pathProgress: { it: '{read} di {total} schede lette · {reviewed} in ripasso', en: '{read} of {total} cards read · {reviewed} in review' },

  // ── Personal lists ────────────────────────────────────────────────────
  bookmarksIntro: { it: 'Le schede che hai salvato per ritrovarle in fretta.', en: 'Cards you saved to find them again quickly.' },
  notesIntro: {
    it: 'Le tue note e i passaggi che hai evidenziato, scheda per scheda.',
    en: 'Your notes and the passages you highlighted, card by card.',
  },
  bookmarksEmpty: { it: 'Nessun segnalibro. Usa “Segnalibro” in una scheda.', en: 'No bookmarks. Use “Bookmark” on a card.' },
  notesEmpty: { it: 'Nessuna nota o evidenziazione salvata.', en: 'No notes or highlights saved.' },
  errorsEmpty: {
    it: 'Il registro è vuoto. Usa “Continuo a dimenticarla” in una scheda o durante il ripasso.',
    en: 'The log is empty. Use “I keep forgetting this” on a card or during review.',
  },
  highlights: { it: 'Evidenziazioni', en: 'Highlights' },
  errorsIntro: {
    it: 'Gli argomenti che continui a dimenticare. Riguardali spesso: quando non ti servono più, eliminali.',
    en: 'Topics you keep forgetting. Look at them often; delete them once you no longer need them.',
  },

  // ── Data ──────────────────────────────────────────────────────────────
  dataIntro: {
    it: 'I tuoi dati sono solo in questo browser. Esporta un file di backup per non perderli o per spostarli su un altro dispositivo.',
    en: 'Your data lives only in this browser. Export a backup file so you do not lose it, or to move it to another device.',
  },
  export: { it: 'Esporta i dati', en: 'Export data' },
  import: { it: 'Importa un file di backup', en: 'Import a backup file' },
  importHelp: {
    it: 'L’importazione unisce i dati: per ogni elemento tiene la versione più recente. Non cancella nulla.',
    en: 'Import merges: for each item it keeps the newest version. It deletes nothing.',
  },
  importDone: { it: 'Importazione completata: {n} elementi aggiornati.', en: 'Import complete: {n} items updated.' },
  importErrorFormat: { it: 'Il file non è un backup valido dell’atlante.', en: 'The file is not a valid atlas backup.' },
  importErrorVersion: {
    it: 'Il file viene da una versione più recente dell’atlante: aggiorna la pagina e riprova.',
    en: 'The file comes from a newer version of the atlas: reload the page and try again.',
  },
  importErrorChecksum: {
    it: 'Il file risulta modificato o danneggiato (controllo di integrità fallito). Non è stato importato nulla.',
    en: 'The file appears modified or damaged (integrity check failed). Nothing was imported.',
  },
  lastExport: { it: 'Ultima esportazione: {date}', en: 'Last export: {date}' },
  neverExported: { it: 'Non hai ancora esportato i dati.', en: 'You have not exported your data yet.' },
  storage: { it: 'Spazio usato', en: 'Storage used' },
  storageValue: { it: '{used} usati di circa {quota} disponibili', en: '{used} used of about {quota} available' },
  persisted: { it: 'Il browser si è impegnato a conservare i dati.', en: 'The browser has agreed to keep this data.' },
  notPersisted: {
    it: 'Il browser può cancellare i dati se manca spazio o, su Safari, dopo 7 giorni senza visite. Esporta un backup ogni tanto.',
    en: 'The browser may clear this data when space runs low or, on Safari, after 7 days without a visit. Export a backup now and then.',
  },
  reminder: {
    it: 'Sono passate più di due settimane dall’ultimo backup. Vuoi esportare i tuoi dati?',
    en: 'It has been more than two weeks since your last backup. Export your data?',
  },
  reminderLater: { it: 'Non ora', en: 'Not now' },

  // ── Entity actions ────────────────────────────────────────────────────
  actions: { it: 'Azioni di studio', en: 'Study actions' },
  addToReview: { it: 'Aggiungi al ripasso', en: 'Add to review' },
  addedToReview: { it: 'Nel ripasso ({n})', en: 'In review ({n})' },
  addedToReviewLive: { it: '{n} flashcard aggiunte al ripasso.', en: '{n} flashcards added to review.' },
  quizMe: { it: 'Quiz su questa scheda', en: 'Quiz me on this' },
  bookmark: { it: 'Segnalibro', en: 'Bookmark' },
  note: { it: 'Nota', en: 'Note' },
  noteLabel: { it: 'La tua nota su questa scheda', en: 'Your note on this card' },
  errorLog: { it: 'Continuo a dimenticarla', en: 'I keep forgetting this' },
  errorLogged: { it: 'Nel registro errori', en: 'In your error log' },
  highlight: { it: 'Salva il testo selezionato', en: 'Save selected text' },
  highlightHelp: {
    it: 'Seleziona del testo in una sezione, poi premi questo pulsante.',
    en: 'Select some text in a section, then press this button.',
  },
  highlightSaved: { it: 'Evidenziazione salvata.', en: 'Highlight saved.' },
  explainWhy: { it: 'Spiega perché', en: 'Explain why' },
  explainHelp: {
    it: 'Prova a rispondere con parole tue, a voce o per iscritto, prima di rileggere la scheda.',
    en: 'Try to answer in your own words, aloud or in writing, before re-reading the card.',
  },
});
