import { describe, expect, it } from 'vitest';
import { createEmptyCard } from 'ts-fsrs';
import { clozeCards, qaCards, occlusionCards, cardId, listItems } from '../src/lib/cards.ts';
import { buildQueue, rate, toStored, toCard, Rating, State, type CardRecord } from '../src/lib/srs.ts';
import { emptyFsrs, entitiesRead, SECTION_COUNT, dueCount, isMastered, parseIdList } from '../src/lib/progress.ts';
import { mergeRecords, makeExport, checkExport, reminderDue, SCHEMA_VERSION } from '../src/lib/db.ts';
import { buildPlan } from '../src/lib/planner.ts';
import { interleave, weakQuestions, entityAccuracy } from '../src/lib/quiz.ts';

const L = (en: string, it: string) => ({ en, it });

describe('flashcards', () => {
  const html = {
    en: '<ul><li>A <strong>alpha</strong> and <strong>beta</strong><!--c:x-c001--></li><li>No bold</li></ul>',
    it: '<ul><li>A <strong>alfa</strong> e <strong>beta</strong></li><li>Niente</li></ul>',
  };
  it('makes one cloze per bold term, blanking each in turn, with ids shared across languages', () => {
    const out = clozeCards({ entity: 'e', module: 'g01', html });
    expect(out.en).toHaveLength(2);
    expect(out.en.map((c) => c.id)).toEqual(out.it.map((c) => c.id));
    expect(out.en[0]!.front).toBe('A <span class="cloze-gap">[…]</span> and <strong>beta</strong>');
    expect(out.it[1]!.back).toBe('A <strong>alfa</strong> e <mark>beta</mark>');
    expect(out.en[0]!.id).toBe(cardId('e', 'cloze', 'A {{alpha}} and beta'));
    expect(out.en[0]!.id).toMatch(/^e:cloze:[0-9a-f]{10}$/);
  });
  it('ignores Italian wording for the id (en source only)', () => {
    const other = clozeCards({ entity: 'e', module: 'g01', html: { ...html, it: html.it.replace('alfa', 'ALFA') } });
    expect(other.en.map((c) => c.id)).toEqual(clozeCards({ entity: 'e', module: 'g01', html }).en.map((c) => c.id));
  });
  it('fails the build on bold-term parity mismatches', () => {
    expect(() => clozeCards({ entity: 'e', module: 'g01', html: { en: html.en, it: html.it.replace('<strong>beta</strong>', 'beta') } })).toThrow(/bold terms/);
  });
  it('keeps nested lists inside their top-level item', () => {
    expect(listItems('<ul><li>a<ul><li>b</li></ul></li><li>c</li></ul>')).toEqual(['a<ul><li>b</li></ul>', 'c']);
  });
  it('escapes quick-check text and makes occlusion cards per annotation', () => {
    const qa = qaCards({ entity: 'e', module: 'g01', quickCheck: [{ q: L('<b>?', '<b>?'), a: L('a', 'a') }] });
    expect(qa.en[0]!.front).toBe('&lt;b&gt;?');
    const shape = { type: 'rect' as const, coords: [0, 0, 1, 1] };
    const occ = occlusionCards('e', 'g01', [
      {
        id: 'img', src: '/x.svg', width: 2, height: 1, alt: L('alt', 'alt'), caption: L('cap', 'did'), section: 'micro',
        annotations: [
          { id: 'b', label: L('B', 'B'), revealOrder: 2, shape },
          { id: 'a', label: L('A', 'A'), revealOrder: 1, shape },
        ],
      },
    ]);
    expect(occ.it.map((c) => c.image?.target)).toEqual([0, 1]);
    expect(occ.it[0]!.back).toContain('<strong>A</strong>');
  });
});

describe('spaced repetition', () => {
  const now = new Date('2026-10-10T09:00:00');
  const cards = ['a', 'b', 'c', 'd'].map((id) => ({ id, entity: 'e', module: 'g01' }));
  it('round-trips stored state and matches createEmptyCard', () => {
    const c = createEmptyCard(now);
    expect(toCard(toStored(c))).toEqual(c);
    expect(emptyFsrs(now.getTime())).toEqual(toStored(c));
  });
  it('queues due cards first, then added new cards, then syllabus order, within the daily limit', () => {
    const { record } = rate(undefined, cards[0]!, Rating.Good, new Date('2026-10-01'));
    const state = new Map<string, CardRecord>([
      ['a', { ...record, fsrs: { ...record.fsrs, due: now.getTime() - 1000 } }],
      ['c', { id: 'c', entity: 'e', module: 'g01', fsrs: emptyFsrs(now.getTime()), added: 1, updated: 1 }],
    ]);
    const q = buildQueue({ cards, state, now, newLimit: 2 });
    expect(q.due.map((c) => c.id)).toEqual(['a']);
    expect(q.news.map((c) => c.id)).toEqual(['c', 'b']);
  });
  it('rating produces a log row and moves a new card out of New', () => {
    const { record, log } = rate(undefined, cards[1]!, Rating.Good, now);
    expect(record.fsrs.state).not.toBe(State.New);
    expect(log).toMatchObject({ card: 'b', rating: Rating.Good, state: State.New, at: now.getTime() });
    expect(dueCount([record], new Date(now.getTime() + 86_400_000))).toBe(1);
    expect(isMastered(record.fsrs)).toBe(false);
  });
});

describe('learner data', () => {
  it('merges by id, newest wins', () => {
    const fresh = mergeRecords(
      [{ id: 'a', updated: 5 }, { id: 'b', updated: 5 }],
      [{ id: 'a', updated: 4 }, { id: 'b', updated: 6 }, { id: 'c', updated: 1 }],
    );
    expect(fresh.map((r) => r.id)).toEqual(['b', 'c']);
  });
  it('accepts its own export and rejects tampered, foreign or newer files', async () => {
    const file = await makeExport({ bookmarks: [{ id: 'x', updated: 1 }] });
    const parsed = JSON.parse(JSON.stringify(file));
    expect((await checkExport(parsed)).ok).toBe(true);
    expect(await checkExport({ ...parsed, stores: { bookmarks: [{ id: 'y', updated: 1 }] } })).toEqual({ ok: false, error: 'checksum' });
    expect(await checkExport({ ...parsed, app: 'other' })).toEqual({ ok: false, error: 'app' });
    expect(await checkExport({ ...parsed, schemaVersion: SCHEMA_VERSION + 1 })).toEqual({ ok: false, error: 'version' });
    expect(await checkExport(null)).toEqual({ ok: false, error: 'format' });
  });
  it('reminds gently: only with data, after 14 days, not right after a dismissal', () => {
    const day = 86_400_000;
    expect(reminderDue(20 * day, { hasData: false, firstUse: 0 })).toBe(false);
    expect(reminderDue(10 * day, { hasData: true, firstUse: 0 })).toBe(false);
    expect(reminderDue(20 * day, { hasData: true, firstUse: 0 })).toBe(true);
    expect(reminderDue(20 * day, { hasData: true, lastExport: 10 * day })).toBe(false);
    expect(reminderDue(20 * day, { hasData: true, firstUse: 0, dismissed: 19 * day })).toBe(false);
  });
  it('counts an entity as read after most of its sections', () => {
    const rows = Array.from({ length: SECTION_COUNT }, (_, i) => ({ entity: i < 12 ? 'a' : 'b', section: `s${i}` }));
    expect([...entitiesRead(rows)]).toEqual(['a']);
  });
});

describe('planner', () => {
  const modules = [
    { id: 's01', section: 'II' as const, order: 30, entities: 4, weakness: 0 },
    { id: 'g01', section: 'I' as const, order: 1, entities: 4, weakness: 0.5 },
  ];
  it('puts general pathology first, weights weak modules, keeps review and a revision week', () => {
    const plan = buildPlan({ today: new Date(2026, 9, 10), examDate: '2026-11-21', hoursPerWeek: 10, modules })!;
    expect(plan.weeks.at(-1)!.kind).toBe('revision');
    expect(plan.weeks.at(-1)!.end).toBe('2026-11-20');
    expect(plan.weeks[0]!.study[0]!.module).toBe('g01');
    expect(plan.neededMinutes).toBe(4 * 45 * 1.5 + 4 * 45);
    expect(plan.weeks.filter((w) => w.kind === 'study').every((w) => w.reviewMinutes > 0)).toBe(true);
    expect(plan.unscheduled).toEqual([]);
  });
  it('reports work that does not fit and rejects past dates', () => {
    const plan = buildPlan({ today: new Date(2026, 9, 10), examDate: '2026-10-20', hoursPerWeek: 1, modules })!;
    expect(plan.unscheduled.length).toBeGreaterThan(0);
    expect(buildPlan({ today: new Date(2026, 9, 10), examDate: '2026-10-01', hoursPerWeek: 5, modules })).toBeNull();
  });
});

describe('quiz selection', () => {
  const qs = [
    { id: 'q1', entities: ['a'] },
    { id: 'q2', entities: ['a'] },
    { id: 'q3', entities: ['b'] },
    { id: 'q4', entities: ['c'] },
  ];
  it('interleaves topics', () => {
    expect(interleave(qs).map((q) => q.id)).toEqual(['q1', 'q3', 'q4', 'q2']);
  });
  it('finds weak areas from the latest attempt per question', () => {
    const attempts = [
      { question: 'q3', entities: ['b'], correct: false, at: 1 },
      { question: 'q3', entities: ['b'], correct: true, at: 2 },
      { question: 'q4', entities: ['c'], correct: false, at: 1 },
    ];
    expect(entityAccuracy(attempts).get('b')).toEqual({ right: 1, total: 1 });
    expect(weakQuestions(qs, attempts).map((q) => q.id)).toEqual(['q4']);
  });
});

describe('parseIdList (<ap-path-progress entities>)', () => {
  it('accepts space-separated, comma-separated and mixed lists', () => {
    expect(parseIdList('a b  c')).toEqual(['a', 'b', 'c']);
    expect(parseIdList('a,b, c')).toEqual(['a', 'b', 'c']);
    expect(parseIdList(' a,\n b c, ')).toEqual(['a', 'b', 'c']);
    expect(parseIdList(null)).toEqual([]);
    expect(parseIdList('')).toEqual([]);
  });
});
