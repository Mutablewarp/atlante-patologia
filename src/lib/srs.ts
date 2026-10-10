/**
 * Spaced repetition on top of ts-fsrs (FSRS v6). Card state is stored in
 * IndexedDB with dates as epoch milliseconds (plain JSON for export/import);
 * these helpers convert to and from ts-fsrs `Card` objects.
 */
import { createEmptyCard, fsrs, Rating, State, type Card, type Grade } from 'ts-fsrs';

export { Rating, State };
export type { Grade };

/** FSRS state as stored (dates → ms). */
export type StoredFsrs = Omit<Card, 'due' | 'last_review'> & { due: number; last_review?: number };

/** One row of the `cards` store. */
export type CardRecord = {
  id: string;
  entity: string;
  module: string;
  fsrs: StoredFsrs;
  /** Explicitly added from an entity page ("Add to review"): introduced first. */
  added?: number;
  updated: number;
};

export const scheduler = fsrs({ enable_fuzz: true });

export function toStored(c: Card): StoredFsrs {
  const { due, last_review, ...rest } = c;
  return { ...rest, due: due.getTime(), ...(last_review ? { last_review: last_review.getTime() } : {}) };
}

export function toCard(s: StoredFsrs): Card {
  const { due, last_review, ...rest } = s;
  return { ...rest, due: new Date(due), ...(last_review !== undefined ? { last_review: new Date(last_review) } : {}) };
}

export const newStored = (now: Date) => toStored(createEmptyCard(now));

export const DAY = 86_400_000;
/** End of the learner's local day: everything due before it is "due today". */
export function endOfDay(now: Date): number {
  const d = new Date(now);
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

export type QueueInput<C extends { id: string; entity: string; module: string }> = {
  /** All generated cards in scope, in syllabus order. */
  cards: readonly C[];
  /** Learner state by card id. */
  state: ReadonlyMap<string, CardRecord>;
  now: Date;
  /** New cards still allowed today. */
  newLimit: number;
};

/**
 * Today's queue: due cards first (most overdue first), then new cards up to the
 * daily limit — explicitly added ones before the rest of the syllabus.
 */
export function buildQueue<C extends { id: string; entity: string; module: string }>({ cards, state, now, newLimit }: QueueInput<C>) {
  const cutoff = endOfDay(now);
  const due: { card: C; at: number }[] = [];
  const added: { card: C; at: number }[] = [];
  const fresh: C[] = [];
  for (const card of cards) {
    const rec = state.get(card.id);
    if (rec && rec.fsrs.state !== State.New) {
      if (rec.fsrs.due <= cutoff) due.push({ card, at: rec.fsrs.due });
    } else if (rec?.added) added.push({ card, at: rec.added });
    else fresh.push(card);
  }
  due.sort((a, b) => a.at - b.at);
  added.sort((a, b) => a.at - b.at);
  const news = [...added.map((x) => x.card), ...fresh].slice(0, Math.max(0, newLimit));
  return { due: due.map((x) => x.card), news };
}

/** Apply one rating. Returns the new stored state and the review-log row. */
export function rate(rec: CardRecord | undefined, card: { id: string; entity: string; module: string }, grade: Grade, now: Date) {
  const current = rec ? toCard(rec.fsrs) : createEmptyCard(now);
  const { card: next, log } = scheduler.next(current, now, grade);
  const record: CardRecord = { id: card.id, entity: card.entity, module: card.module, fsrs: toStored(next), updated: now.getTime() };
  if (rec?.added) record.added = rec.added;
  const at = now.getTime();
  return {
    record,
    log: { id: `${card.id}@${at}`, card: card.id, entity: card.entity, module: card.module, rating: grade, state: log.state, at, updated: at },
  };
}

/** Preview the next interval for each rating (for the button labels). */
export function previewIntervals(rec: CardRecord | undefined, now: Date): Record<Grade, number> {
  const current = rec ? toCard(rec.fsrs) : createEmptyCard(now);
  const p = scheduler.repeat(current, now);
  return {
    [Rating.Again]: p[Rating.Again].card.due.getTime() - now.getTime(),
    [Rating.Hard]: p[Rating.Hard].card.due.getTime() - now.getTime(),
    [Rating.Good]: p[Rating.Good].card.due.getTime() - now.getTime(),
    [Rating.Easy]: p[Rating.Easy].card.due.getTime() - now.getTime(),
  } as Record<Grade, number>;
}
