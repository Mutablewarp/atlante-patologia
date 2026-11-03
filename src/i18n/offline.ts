import { defineStrings } from './index.ts';

/** Offline use: fallback page, offline-packs page (/me/offline/) and the update notice. */
export const tOffline = defineStrings({
  // /{lang}/offline/ — served by the service worker when a page is not saved
  fallbackTitle: { it: 'Sei offline', en: 'You are offline' },
  fallbackMeta: {
    it: 'Pagina mostrata quando manca la rete e la pagina richiesta non è salvata sul dispositivo.',
    en: 'Page shown when there is no connection and the requested page is not saved on this device.',
  },
  fallbackBody: {
    it: 'La rete non risponde e questa pagina non è salvata sul dispositivo. La home e i capitoli che hai scaricato restano disponibili anche senza connessione.',
    en: 'The network is not responding and this page is not saved on this device. The home page and the chapters you downloaded still work without a connection.',
  },
  retry: { it: 'Riprova', en: 'Try again' },
  goHome: { it: 'Vai alla home', en: 'Go to the home page' },
  manage: { it: 'Gestisci i capitoli offline', en: 'Manage offline chapters' },

  // /{lang}/me/offline/
  title: { it: 'Uso offline', en: 'Offline use' },
  metaDescription: {
    it: 'Scarica i capitoli per studiare senza connessione, controlla lo spazio occupato e scopri come funziona su iPhone e Android.',
    en: 'Download chapters to study without a connection, check the space they use and learn how it works on iPhone and Android.',
  },
  intro: {
    it: 'Dopo la prima visita, la home e questa pagina si aprono anche senza connessione. I capitoli si scaricano uno alla volta, solo se lo scegli tu.',
    en: 'After your first visit, the home page and this page open without a connection too. Chapters are downloaded one at a time, only if you choose to.',
  },
  noJs: {
    it: 'Per scaricare i capitoli serve JavaScript attivo nel browser.',
    en: 'Downloading chapters requires JavaScript to be enabled in your browser.',
  },
  noSupport: {
    it: 'Questo browser non supporta l’uso offline (service worker non disponibile). Puoi comunque leggere l’atlante online.',
    en: 'This browser does not support offline use (no service worker). You can still read the atlas online.',
  },
  packsTitle: { it: 'Capitoli da scaricare', en: 'Chapters to download' },
  noPacks: {
    it: 'Nessun capitolo è ancora pubblicato: i download compariranno qui appena esce il primo.',
    en: 'No chapter is published yet: downloads will appear here as soon as the first one is out.',
  },
  download: { it: 'Scarica', en: 'Download' },
  downloadLabel: { it: 'Scarica {module}', en: 'Download {module}' },
  remove: { it: 'Rimuovi', en: 'Remove' },
  removeLabel: { it: 'Rimuovi {module} dal dispositivo', en: 'Remove {module} from this device' },
  update: { it: 'Aggiorna', en: 'Update' },
  updateLabel: { it: 'Aggiorna {module}', en: 'Update {module}' },
  stateNone: { it: 'Non scaricato', en: 'Not downloaded' },
  stateInstalled: { it: 'Disponibile offline', en: 'Available offline' },
  stateOutdated: { it: 'Scaricato, c’è una versione più recente', en: 'Downloaded, a newer version exists' },
  stateWorking: { it: 'Download in corso…', en: 'Downloading…' },
  stateError: {
    it: 'Download non riuscito. Controlla la connessione e riprova.',
    en: 'Download failed. Check your connection and try again.',
  },
  storageTitle: { it: 'Spazio occupato', en: 'Storage used' },
  storageUsage: { it: '{used} usati su circa {quota} disponibili per questo sito', en: '{used} used of about {quota} available to this site' },
  storageUnknown: { it: 'Questo browser non indica lo spazio occupato.', en: 'This browser does not report the space used.' },
  persistTitle: { it: 'Conservazione dei dati', en: 'Keeping your data' },
  persistYes: {
    it: 'Il browser ha reso permanente lo spazio dell’atlante: non lo svuoterà da solo quando manca memoria.',
    en: 'The browser has made the atlas storage persistent: it will not clear it on its own when space runs low.',
  },
  persistNo: {
    it: 'Il browser può liberare lo spazio dell’atlante se il dispositivo ha poca memoria. Lo chiediamo come permanente quando scarichi un capitolo; la decisione spetta al browser.',
    en: 'The browser may clear the atlas storage if the device runs low on space. We ask for persistent storage when you download a chapter; the browser decides.',
  },
  persistUnknown: { it: 'Questo browser non indica se lo spazio è permanente.', en: 'This browser does not say whether storage is persistent.' },
  iosTitle: { it: 'iPhone e iPad (Safari)', en: 'iPhone and iPad (Safari)' },
  iosRule: {
    it: 'Se usi l’atlante dal browser Safari e non lo apri per 7 giorni di utilizzo di Safari, Safari cancella tutti i dati del sito: capitoli scaricati e progressi.',
    en: 'If you use the atlas in the Safari browser and do not open it for 7 days of Safari use, Safari deletes all of the site’s data: downloaded chapters and progress.',
  },
  iosHome: {
    it: 'Se aggiungi l’atlante alla schermata Home, diventa un’app separata da Safari con un suo contatore: conta solo i giorni in cui la usi, e ogni apertura lo azzera.',
    en: 'If you add the atlas to the Home Screen, it becomes an app separate from Safari with its own counter: it counts only the days you use it, and each time you open it the count restarts.',
  },
  iosExport: {
    it: 'In ogni caso conserva una copia dei tuoi progressi: l’esportazione in un file arriverà con gli strumenti di studio.',
    en: 'Either way, keep a copy of your progress: export to a file arrives with the study tools.',
  },
  installTitle: { it: 'Aggiungere l’atlante alla schermata Home', en: 'Adding the atlas to your Home Screen' },
  installIntro: {
    it: 'È facoltativo: l’atlante funziona anche dal browser. Se lo aggiungi, si apre a schermo intero come un’app.',
    en: 'This is optional: the atlas works in the browser too. If you add it, it opens full screen like an app.',
  },
  installStandalone: { it: 'Stai già usando l’atlante come app.', en: 'You are already using the atlas as an app.' },
  installIos: {
    it: 'iPhone e iPad: in Safari tocca il pulsante Condividi, poi “Aggiungi alla schermata Home”.',
    en: 'iPhone and iPad: in Safari, tap the Share button, then “Add to Home Screen”.',
  },
  installAndroid: {
    it: 'Android: in Chrome apri il menu ⋮ e scegli “Installa app” oppure “Aggiungi a schermata Home”.',
    en: 'Android: in Chrome, open the ⋮ menu and choose “Install app” or “Add to Home screen”.',
  },
  meLinkTitle: { it: 'Uso offline', en: 'Offline use' },
  meLinkBody: {
    it: 'Scarica i capitoli da studiare senza connessione e controlla lo spazio occupato.',
    en: 'Download chapters to study without a connection and check the space they use.',
  },

  // Update notice (every page)
  updateReady: { it: 'È disponibile una nuova versione dell’atlante.', en: 'A new version of the atlas is available.' },
  updateReload: { it: 'Ricarica', en: 'Reload' },
  updateLater: { it: 'Più tardi', en: 'Later' },
});
