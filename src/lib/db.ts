/**
 * The learner's data: IndexedDB database `atlas` (idb wrapper). Nothing leaves
 * the device; export/import moves it between browsers as a JSON file.
 *
 * Every record has an `id` and an `updated` timestamp (ms). Import merges by id
 * and keeps the newest record. Removals are tombstones (`deleted: true`) so a
 * later import of an older file cannot resurrect them.
 */
import { openDB, type IDBPDatabase } from 'idb';
import type { CardRecord } from './srs.ts';

export const DB_NAME = 'atlas';
/** IndexedDB version: bump and add an upgrade step when stores change. */
export const DB_VERSION = 1;
/** Export file format version. */
export const SCHEMA_VERSION = 1;
export const APP_ID = 'atlante-patologia';

export const STORES = [
  'cards',
  'reviewLog',
  'bookmarks',
  'notes',
  'highlights',
  'errors',
  'readProgress',
  'recent',
  'quizAttempts',
  'plan',
  'settings',
] as const;
export type StoreName = (typeof STORES)[number];

type Base = { id: string; updated: number; deleted?: boolean };
export type Names = { it: string; en: string };
export type ReviewLogRecord = Base & { card: string; entity: string; module: string; rating: number; state: number; at: number };
/** Bookmark and note ids are the entity id. Names are resolved from the study index when listed. */
export type BookmarkRecord = Base;
export type NoteRecord = Base & { text: string };
export type HighlightRecord = Base & { entity: string; section: string; text: string };
/** Error log: id `entity:<id>` (whole card) or `card:<card id>` (one flashcard). */
export type ErrorRecord = Base & { entity: string; card?: string };
export type ReadRecord = Base & { entity: string; section: string; at: number };
export type RecentRecord = Base & { names: Names; module: string; section?: string; at: number };
export type QuizAttemptRecord = Base & {
  question: string;
  entities: string[];
  module: string;
  correct: boolean;
  mode: string;
  at: number;
};
export type PlanRecord = Base & { examDate: string; hoursPerWeek: number };
export type SettingRecord = Base & { value: unknown };

export type StoreRecord = {
  cards: CardRecord;
  reviewLog: ReviewLogRecord;
  bookmarks: BookmarkRecord;
  notes: NoteRecord;
  highlights: HighlightRecord;
  errors: ErrorRecord;
  readProgress: ReadRecord;
  recent: RecentRecord;
  quizAttempts: QuizAttemptRecord;
  plan: PlanRecord;
  settings: SettingRecord;
};

export const RECENT_MAX = 20;

// ── Pure helpers (unit-tested) ───────────────────────────────────────────

/** Records from `incoming` that should be written: unknown ids, or a newer `updated`. */
export function mergeRecords<R extends Base>(existing: readonly R[], incoming: readonly R[]): R[] {
  const have = new Map(existing.map((r) => [r.id, r.updated]));
  return incoming.filter((r) => !have.has(r.id) || r.updated > (have.get(r.id) ?? 0));
}

export type ExportFile = {
  app: typeof APP_ID;
  schemaVersion: number;
  exportedAt: string;
  checksum: string;
  stores: { [K in StoreName]?: StoreRecord[K][] };
};

export async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function makeExport(stores: ExportFile['stores'], now = new Date()): Promise<ExportFile> {
  return { app: APP_ID, schemaVersion: SCHEMA_VERSION, exportedAt: now.toISOString(), checksum: await sha256(JSON.stringify(stores)), stores };
}

export type ImportCheck = { ok: true; file: ExportFile } | { ok: false; error: 'format' | 'app' | 'version' | 'checksum' | 'records' };

/** Structural and integrity check of a parsed export file (trust boundary). */
export async function checkExport(raw: unknown): Promise<ImportCheck> {
  if (!raw || typeof raw !== 'object') return { ok: false, error: 'format' };
  const f = raw as Partial<ExportFile>;
  if (f.app !== APP_ID) return { ok: false, error: 'app' };
  if (typeof f.schemaVersion !== 'number' || f.schemaVersion < 1 || f.schemaVersion > SCHEMA_VERSION)
    return { ok: false, error: 'version' };
  if (!f.stores || typeof f.stores !== 'object' || typeof f.checksum !== 'string') return { ok: false, error: 'format' };
  if ((await sha256(JSON.stringify(f.stores))) !== f.checksum) return { ok: false, error: 'checksum' };
  for (const [name, rows] of Object.entries(f.stores)) {
    if (!(STORES as readonly string[]).includes(name) || !Array.isArray(rows)) return { ok: false, error: 'records' };
    for (const r of rows as unknown[]) {
      const rec = r as Partial<Base> | null;
      if (!rec || typeof rec !== 'object' || typeof rec.id !== 'string' || typeof rec.updated !== 'number')
        return { ok: false, error: 'records' };
    }
  }
  return { ok: true, file: f as ExportFile };
}

export const REMINDER_DAYS = 14;
/** Gentle export reminder: only with data, 14 days after the last export (or first use), and not right after a dismissal. */
export function reminderDue(now: number, s: { lastExport?: number; firstUse?: number; dismissed?: number; hasData: boolean }): boolean {
  if (!s.hasData) return false;
  const span = REMINDER_DAYS * 86_400_000;
  const since = s.lastExport ?? s.firstUse;
  if (since === undefined || now - since < span) return false;
  return s.dismissed === undefined || now - s.dismissed >= span;
}

// ── IndexedDB access (browser only) ──────────────────────────────────────

let handle: Promise<IDBPDatabase> | undefined;

export function db(): Promise<IDBPDatabase> {
  handle ??= openDB(DB_NAME, DB_VERSION, {
    upgrade(d, oldVersion) {
      if (oldVersion < 1) for (const s of STORES) d.createObjectStore(s, { keyPath: 'id' });
    },
  });
  return handle;
}

const changed = () => {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('ap:data'));
};

export async function getAll<S extends StoreName>(store: S, includeDeleted = false): Promise<StoreRecord[S][]> {
  const rows = (await (await db()).getAll(store)) as StoreRecord[S][];
  return includeDeleted ? rows : rows.filter((r) => !(r as Base).deleted);
}

export async function get<S extends StoreName>(store: S, id: string): Promise<StoreRecord[S] | undefined> {
  const r = (await (await db()).get(store, id)) as StoreRecord[S] | undefined;
  return r && !(r as Base).deleted ? r : undefined;
}

export async function put<S extends StoreName>(store: S, rec: StoreRecord[S]): Promise<void> {
  await (await db()).put(store, rec);
  await touchFirstUse();
  changed();
}

export async function putMany<S extends StoreName>(store: S, recs: StoreRecord[S][]): Promise<void> {
  const tx = (await db()).transaction(store, 'readwrite');
  await Promise.all([...recs.map((r) => tx.store.put(r)), tx.done]);
  changed();
}

/** Tombstone delete (see header). */
export async function remove(store: StoreName, id: string): Promise<void> {
  const d = await db();
  const r = (await d.get(store, id)) as Base | undefined;
  if (!r) return;
  await d.put(store, { ...r, deleted: true, updated: Date.now() });
  changed();
}

export async function getSetting<T>(key: string): Promise<T | undefined> {
  return (await get('settings', key))?.value as T | undefined;
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  await (await db()).put('settings', { id: key, value, updated: Date.now() });
  changed();
}

async function touchFirstUse() {
  const d = await db();
  if (!(await d.get('settings', 'firstUse'))) await d.put('settings', { id: 'firstUse', value: Date.now(), updated: Date.now() });
}

/** Ask the browser to keep our data (once, after the first saved review — never on page load). */
export async function requestPersistOnce(): Promise<void> {
  if (await getSetting('persistAsked')) return;
  await setSetting('persistAsked', Date.now());
  try {
    await navigator.storage?.persist?.();
  } catch {
    /* not supported: data stays best-effort */
  }
}

export async function recordRecent(rec: Omit<RecentRecord, 'updated' | 'at'>): Promise<void> {
  const now = Date.now();
  await put('recent', { ...rec, at: now, updated: now });
  const all = (await getAll('recent')).sort((a, b) => b.at - a.at);
  const d = await db();
  await Promise.all(all.slice(RECENT_MAX).map((r) => d.delete('recent', r.id)));
}

export async function exportAll(): Promise<ExportFile> {
  const stores: ExportFile['stores'] = {};
  for (const s of STORES) (stores as Record<string, unknown[]>)[s] = await getAll(s, true);
  const file = await makeExport(stores);
  await setSetting('lastExport', Date.now());
  return file;
}

/** Merge a checked export file into the database. Returns the number of records written. */
export async function importFile(file: ExportFile): Promise<number> {
  let written = 0;
  for (const s of STORES) {
    const incoming = (file.stores[s] ?? []) as StoreRecord[typeof s][];
    if (!incoming.length) continue;
    const fresh = mergeRecords(await getAll(s, true), incoming);
    if (fresh.length) await putMany(s, fresh);
    written += fresh.length;
  }
  const recent = (await getAll('recent')).sort((a, b) => b.at - a.at);
  const d = await db();
  await Promise.all(recent.slice(RECENT_MAX).map((r) => d.delete('recent', r.id)));
  return written;
}

/** True when the learner has saved anything at all. */
export async function hasData(): Promise<boolean> {
  const d = await db();
  for (const s of STORES) if (s !== 'settings' && (await d.count(s)) > 0) return true;
  return false;
}
