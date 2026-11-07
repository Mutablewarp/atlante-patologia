/**
 * Import trust boundary for learner data (ARCHITECTURE §5): checks a parsed
 * export file before anything is written. Only the data page loads it, so the
 * pages that merely read and write the database (lib/db.ts) do not ship it.
 */
import { APP_ID, SCHEMA_VERSION, STORES, sha256, type ExportFile, type Names, type StoreName } from './db.ts';
import { isConfidence } from './metacog.ts';
import { isOralSession } from './oral.ts';

export type ImportCheck =
  | { ok: true; file: ExportFile; skipped: number }
  | { ok: false; error: 'format' | 'app' | 'version' | 'checksum' | 'records' };

const str = (x: unknown): x is string => typeof x === 'string';
const num = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const FSRS_NUMBERS = ['due', 'stability', 'difficulty', 'elapsed_days', 'scheduled_days', 'learning_steps', 'reps', 'lapses'] as const;

/** A stored FSRS state as review, the scheduler and the Me page read it (every field ts-fsrs writes). */
export function isStoredFsrs(x: unknown): boolean {
  const f = x as Record<string, unknown> | null;
  return (
    !!f &&
    typeof f === 'object' &&
    FSRS_NUMBERS.every((k) => num(f[k])) &&
    [0, 1, 2, 3].includes(f.state as number) &&
    (f.last_review === undefined || num(f.last_review))
  );
}

/** The fields the study tools read from a record of each store. */
const READABLE: { [K in StoreName]: (r: Record<string, unknown>) => boolean } = {
  cards: (r) => str(r.entity) && str(r.module) && isStoredFsrs(r.fsrs) && (r.added === undefined || num(r.added)),
  reviewLog: (r) =>
    str(r.card) && str(r.entity) && str(r.module) && num(r.rating) && num(r.state) && num(r.at) && (r.confidence === undefined || isConfidence(r.confidence)),
  bookmarks: () => true,
  notes: (r) => str(r.text),
  highlights: (r) => str(r.entity) && str(r.section) && str(r.text),
  errors: (r) => str(r.entity) && (r.card === undefined || str(r.card)),
  readProgress: (r) => str(r.entity) && str(r.section) && num(r.at),
  recent: (r) => {
    const n = r.names as Partial<Names> | null;
    return !!n && str(n.it) && str(n.en) && str(r.module) && num(r.at) && (r.section === undefined || str(r.section));
  },
  quizAttempts: (r) =>
    str(r.question) &&
    Array.isArray(r.entities) &&
    r.entities.every(str) &&
    str(r.module) &&
    typeof r.correct === 'boolean' &&
    str(r.mode) &&
    num(r.at) &&
    (r.confidence === undefined || isConfidence(r.confidence)),
  plan: (r) => str(r.examDate) && num(r.hoursPerWeek),
  settings: () => true,
  oralSessions: isOralSession,
};

/** A record import may write: an id, a timestamp and, unless it is a tombstone (never read), every field the tools read. */
export function isImportable(store: StoreName, r: unknown): boolean {
  const rec = r as { id?: unknown; updated?: unknown; deleted?: unknown } | null;
  if (!rec || typeof rec !== 'object' || typeof rec.id !== 'string' || !num(rec.updated)) return false;
  return rec.deleted === true || READABLE[store](rec as Record<string, unknown>);
}

/**
 * Structural and integrity check of a parsed export file (trust boundary). A record the
 * tools could not read is left out and counted in `skipped`, so one damaged record never
 * blocks the rest of a backup; `file` holds only the records import may write.
 */
export async function checkExport(raw: unknown): Promise<ImportCheck> {
  if (!raw || typeof raw !== 'object') return { ok: false, error: 'format' };
  const f = raw as Partial<ExportFile>;
  if (f.app !== APP_ID) return { ok: false, error: 'app' };
  if (typeof f.schemaVersion !== 'number' || f.schemaVersion < 1 || f.schemaVersion > SCHEMA_VERSION)
    return { ok: false, error: 'version' };
  if (!f.stores || typeof f.stores !== 'object' || typeof f.checksum !== 'string') return { ok: false, error: 'format' };
  if ((await sha256(JSON.stringify(f.stores))) !== f.checksum) return { ok: false, error: 'checksum' };
  const stores: Record<string, unknown[]> = {};
  let skipped = 0;
  for (const [name, rows] of Object.entries(f.stores)) {
    if (!(STORES as readonly string[]).includes(name) || !Array.isArray(rows)) return { ok: false, error: 'records' };
    stores[name] = rows.filter((r) => isImportable(name as StoreName, r));
    skipped += rows.length - stores[name].length;
  }
  return { ok: true, file: { ...(f as ExportFile), stores: stores as ExportFile['stores'] }, skipped };
}
