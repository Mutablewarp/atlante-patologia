import { describe, expect, it } from 'vitest';
import { organProgress } from '../src/scripts/body-progress.ts';
import { emptyFsrs } from '../src/lib/progress.ts';

const now = new Date(2026, 10, 15, 10, 0, 0);
const DAY = 86_400_000;
const review = (stability: number, dueIn: number) => ({ ...emptyFsrs(now.getTime()), state: 2, stability, due: now.getTime() + dueIn });

describe('organProgress', () => {
  const groups = { heart: ['a', 'b', 'c'], lung: ['c', 'd'], empty: [] as string[] };

  it('counts zero everywhere without learner data', () => {
    const r = organProgress(groups, { read: [], logged: [], cards: [] }, now);
    expect(r.heart).toEqual({ total: 3, seen: 0, mastered: 0, due: 0 });
    expect(r.empty).toEqual({ total: 0, seen: 0, mastered: 0, due: 0 });
  });

  it('seen: a read record, a review-log entry or a card record counts once per entity', () => {
    const r = organProgress(groups, { read: ['a', 'a'], logged: ['b', 'zzz'], cards: [{ entity: 'c', fsrs: emptyFsrs(now.getTime()) }] }, now);
    expect(r.heart.seen).toBe(3);
    expect(r.lung.seen).toBe(1);
  });

  it('mastered needs every card of the entity mature; due needs one card due today', () => {
    const r = organProgress(
      groups,
      {
        read: [],
        logged: [],
        cards: [
          { entity: 'a', fsrs: review(30, 5 * DAY) },
          { entity: 'a', fsrs: review(25, 9 * DAY) },
          { entity: 'b', fsrs: review(30, 5 * DAY) },
          { entity: 'b', fsrs: review(2, -DAY) },
          { entity: 'c', fsrs: { ...emptyFsrs(now.getTime()), due: now.getTime() - DAY } },
        ],
      },
      now,
    );
    expect(r.heart).toEqual({ total: 3, seen: 3, mastered: 1, due: 1 });
    expect(r.lung.due).toBe(0);
  });
});
