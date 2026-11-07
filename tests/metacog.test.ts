import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { calibration, overconfident, luckyGuesses, advice, pct, type Judged } from '../src/lib/metacog.ts';
import { drawQuestions, isOralSession, oralCalibration, rubricMean, type OralItem, type OralQuestion } from '../src/lib/oral.ts';
import { makeExport, sha256, storesToCreate, STORES, DB_VERSION, SCHEMA_VERSION, STORES_ADDED_IN, type StoreName } from '../src/lib/db.ts';
import { checkExport, isImportable } from '../src/lib/import-check.ts';
import { entitySchema } from '../src/lib/schema.ts';

const j = (entity: string, confidence: 1 | 2 | 3 | undefined, correct: boolean): Judged => ({ entities: [entity], confidence, correct });

describe('confidence calibration', () => {
  const items = [j('a', 3, false), j('a', 3, false), j('b', 3, true), j('c', 1, true), j('c', 1, false), j('d', 2, true), j('e', undefined, false)];
  it('counts right / total per level and ignores answers without confidence', () => {
    expect(calibration(items)).toEqual([
      { level: 1, right: 1, total: 2 },
      { level: 2, right: 1, total: 1 },
      { level: 3, right: 1, total: 3 },
    ]);
    expect(calibration([{ entities: ['x'], confidence: 7 as never, correct: true }]).every((s) => s.total === 0)).toBe(true);
  });
  it('lists overconfident topics (sure, wrong) and lucky guesses (guessing, right), most frequent first', () => {
    expect(overconfident([...items, j('b', 3, false)])).toEqual([
      { entity: 'a', n: 2 },
      { entity: 'b', n: 1 },
    ]);
    expect(luckyGuesses(items)).toEqual([{ entity: 'c', n: 1 }]);
  });
  it('gives advice only with enough answers', () => {
    expect(advice(calibration(items))).toBe('tooFew');
    const many = (c: 1 | 2 | 3, right: number, wrong: number) => [
      ...Array.from({ length: right }, () => j('x', c, true)),
      ...Array.from({ length: wrong }, () => j('x', c, false)),
    ];
    expect(advice(calibration([...many(3, 6, 4), ...many(1, 0, 2)]))).toBe('overconfident');
    expect(advice(calibration([...many(3, 8, 1), ...many(1, 4, 1)]))).toBe('underconfident');
    expect(advice(calibration([...many(3, 8, 1), ...many(1, 1, 4)]))).toBe('calibrated');
    // A level counts only with enough answers, and the middle level counts too (review findings).
    expect(advice(calibration(many(2, 0, 10)))).toBe('fairlyWrong');
    expect(advice(calibration([...many(2, 0, 9), ...many(3, 1, 0)]))).toBe('fairlyWrong');
    expect(advice(calibration([...many(1, 0, 9), ...many(3, 0, 1)]))).toBe('oneLevel');
    expect(advice(calibration(many(2, 10, 0)))).toBe('oneLevel');
    expect(advice(calibration([...many(2, 8, 0), ...many(3, 2, 0)]))).toBe('oneLevel'); // 8 of 10 at one level
    // Spread over the levels but under 5 at two of them: "you always chose the same level" would be false.
    expect(advice(calibration([...many(1, 2, 2), ...many(2, 2, 1), ...many(3, 3, 0)]))).toBe('tooFew');
    expect(advice(calibration([...many(3, 8, 1), ...many(1, 1, 3)]))).toBe('tooFew');
    // Accuracy that falls as confidence rises is never "calibrated" (second review).
    expect(advice(calibration([...many(1, 6, 4), ...many(2, 5, 5)]))).toBe('notRising');
    expect(advice(calibration([...many(1, 3, 2), ...many(2, 5, 5), ...many(3, 15, 5)]))).toBe('notRising');
    expect(advice(calibration([...many(1, 3, 2), ...many(2, 6, 4), ...many(3, 16, 4)]))).toBe('calibrated');
    // Every "sure" answer wrong (too few to count alone) and every guess right: not "trust yourself more".
    expect(advice(calibration([...many(3, 0, 4), ...many(1, 6, 0)]))).toBe('notRising');
    expect(advice(calibration([...many(3, 3, 1), ...many(1, 6, 0)]))).toBe('underconfident');
    expect(pct(1, 3)).toBe(33);
    expect(pct(0, 0)).toBe(0);
  });
});

describe('oral exam simulator', () => {
  const q = (entity: string, module: string, n = 1): OralQuestion => ({
    id: `${entity}#${n}`,
    entity,
    name: entity,
    module,
    level: 1,
    text: `${entity} ${n}?`,
    focus: [{ id: 'definition', label: 'Definition', href: `/e/${entity}/#definition` }],
  });
  const seq = (...xs: number[]) => {
    let i = 0;
    return () => xs[i++ % xs.length]!;
  };
  it('draws three questions from distinct entities, spread across chapters', () => {
    const pool = [q('a', 'g01'), q('a', 'g01', 2), q('b', 'g01'), q('c', 'g02'), q('d', 's10')];
    for (const r of [seq(0), seq(0.99), seq(0.3, 0.7, 0.1)]) {
      const out = drawQuestions(pool, 3, r);
      expect(out).toHaveLength(3);
      expect(new Set(out.map((x) => x.entity)).size).toBe(3);
      expect(new Set(out.map((x) => x.module)).size).toBe(3);
    }
  });
  it('fills from the same entity only when there are too few entities, and never repeats a question', () => {
    const out = drawQuestions([q('a', 'g01'), q('a', 'g01', 2), q('b', 'g01')], 3, seq(0.5));
    expect(out).toHaveLength(3);
    expect(new Set(out.map((x) => x.id)).size).toBe(3);
    expect(new Set(out.slice(0, 2).map((x) => x.entity)).size).toBe(2);
    expect(drawQuestions([q('a', 'g01')], 3)).toHaveLength(1);
    expect(drawQuestions([], 3)).toEqual([]);
  });
  it('compares predicted and self-assessed scores', () => {
    const item = (predicted: 1 | 2 | 3 | 4, r: 1 | 2 | 3 | 4): OralItem => ({
      question: 'a#1',
      entity: 'a',
      text: '?',
      predicted,
      rubric: { completeness: r, accuracy: r, structure: r, terminology: r },
    });
    expect(rubricMean({ completeness: 1, accuracy: 2, structure: 3, terminology: 4 })).toBe(2.5);
    expect(oralCalibration([item(4, 2), item(4, 2)]).bias).toBe('tooFew');
    expect(oralCalibration([item(4, 2), item(4, 3), item(3, 2)])).toMatchObject({ n: 3, bias: 'over' });
    expect(oralCalibration([item(1, 3), item(2, 3), item(2, 2)]).bias).toBe('under');
    expect(oralCalibration([item(3, 3), item(2, 2), item(4, 3)])).toMatchObject({ bias: 'calibrated', predicted: 3, gap: expect.closeTo(1 / 3) });
    expect(oralCalibration([])).toMatchObject({ n: 0, predicted: 0, assessed: 0 });
  });
});

describe('learner data v2 (migration and export)', () => {
  it('creates every store on a new database and only the new store when upgrading from v1', () => {
    expect(DB_VERSION).toBe(2);
    expect(storesToCreate(0).sort()).toEqual([...STORES].sort());
    expect(storesToCreate(1)).toEqual(['oralSessions']);
    expect(storesToCreate(DB_VERSION)).toEqual([]);
    // Upgrades only add stores: every v1 store is still in the list (records kept).
    for (const s of STORES_ADDED_IN[1]) expect(STORES).toContain(s);
  });
  it('exports oral sessions and confidence, and still accepts a v1 export file', async () => {
    const file = JSON.parse(
      JSON.stringify(
        await makeExport({
          quizAttempts: [{ id: 'q@1', question: 'q', entities: ['a'], module: 'g01', correct: true, mode: 'topic', at: 1, updated: 1, confidence: 3 }],
          oralSessions: [
            {
              id: 'oral@1',
              at: 1,
              updated: 1,
              items: [{ question: 'a#1', entity: 'a', text: '?', predicted: 2, rubric: { completeness: 2, accuracy: 3, structure: 2, terminology: 2 }, seconds: 40 }],
            },
          ],
        }),
      ),
    );
    expect(file.schemaVersion).toBe(SCHEMA_VERSION);
    expect(await checkExport(file)).toMatchObject({ ok: true, skipped: 0 });
    const v1Stores = {
      bookmarks: [{ id: 'x', updated: 1 }],
      quizAttempts: [{ id: 'q@1', question: 'q', entities: ['a'], module: 'g01', correct: false, mode: 'topic', at: 1, updated: 1 }],
    };
    const v1 = { app: 'atlante-patologia', schemaVersion: 1, exportedAt: '2026-10-10T00:00:00.000Z', checksum: await sha256(JSON.stringify(v1Stores)), stores: v1Stores };
    expect(await checkExport(v1)).toMatchObject({ ok: true, skipped: 0, file: { stores: v1Stores } });
    expect(await checkExport({ ...v1, stores: { ...v1Stores, unknown: [] } })).toEqual({ ok: false, error: 'checksum' });
  });
});

describe('examQuestions in the entity schema', () => {
  const fx = parse(readFileSync(new URL('../src/content/entities/_fixture-demo/meta.yaml', import.meta.url), 'utf8'));
  it('accepts the fixture questions and defaults to none', () => {
    expect(entitySchema.parse(fx).examQuestions.length).toBeGreaterThan(0);
    expect(entitySchema.parse({ ...fx, examQuestions: undefined }).examQuestions).toEqual([]);
  });
  it('rejects unknown focus sections, empty focus and levels outside 1–3', () => {
    const one = (patch: object) => ({ ...fx, examQuestions: [{ it: 'Domanda?', en: 'Question?', focus: ['definition'], level: 1, ...patch }] });
    expect(entitySchema.safeParse(one({})).success).toBe(true);
    expect(entitySchema.safeParse(one({ focus: ['quick-check'] })).success).toBe(false);
    expect(entitySchema.safeParse(one({ focus: [] })).success).toBe(false);
    expect(entitySchema.safeParse(one({ level: 4 })).success).toBe(false);
    expect(entitySchema.safeParse(one({ en: '' })).success).toBe(false);
  });
});

describe('import trust boundary for oral sessions', () => {
  const file = async (items: unknown, session: object = {}) => {
    const stores = { oralSessions: [{ id: 'oral@1', at: 1, updated: 1, items, ...session }] };
    return { app: 'atlante-patologia', schemaVersion: 2, exportedAt: '', checksum: await sha256(JSON.stringify(stores)), stores };
  };
  /** What import would write, and how many records it left out. */
  const kept = async (f: unknown) => {
    const c = await checkExport(f);
    if (!c.ok) throw new Error(c.error);
    return { rows: c.file.stores.oralSessions ?? [], skipped: c.skipped };
  };
  const rubric = { completeness: 3, accuracy: 3, structure: 2, terminology: 4 };
  const good = { question: 'a#1', entity: 'a', text: '?', predicted: 3, rubric, seconds: 75 };
  it('keeps well-formed items and leaves out missing rubric criteria, bad scores and non-arrays', async () => {
    expect(await kept(await file([{ question: 'a#1', entity: 'a', text: '?', predicted: 3, rubric }]))).toMatchObject({ rows: [{ id: 'oral@1' }], skipped: 0 });
    for (const bad of [
      [{ question: 'a#1', entity: 'a', text: '?', predicted: 3 }],
      [{ question: 'a#1', entity: 'a', text: '?', predicted: 3, rubric: { ...rubric, accuracy: undefined } }],
      [{ question: 'a#1', entity: 'a', text: '?', predicted: 7, rubric }],
      'x',
    ])
      expect(await kept(await file(bad))).toEqual({ rows: [], skipped: 1 });
  });
  it('checks every field of a session and of its items, and lets tombstones through', async () => {
    expect((await kept(await file([good]))).skipped).toBe(0);
    for (const [items, session] of [
      [[{ ...good, entity: undefined }], {}],
      [[{ ...good, text: 3 }], {}],
      [[{ ...good, question: null }], {}],
      [[{ ...good, seconds: -1 }], {}],
      [[{ ...good, seconds: '75' }], {}],
      [[good, { ...good, rubric: 'all 4' }], {}],
      [[], {}], // the simulator never saves an empty session
      [[good], { at: '2026-11-04' }],
    ] as const)
      expect(await kept(await file(items, session))).toEqual({ rows: [], skipped: 1 });
    // A deleted session keeps whatever it held: it is never read, only merged.
    expect(await kept(await file('x', { deleted: true }))).toMatchObject({ rows: [{ id: 'oral@1', deleted: true }], skipped: 0 });
  });
  it('still rejects a file it cannot trust as a whole', async () => {
    const f = await file([good]);
    expect(await checkExport({ ...f, checksum: 'x' })).toEqual({ ok: false, error: 'checksum' });
    const odd = { unknown: [] };
    expect(await checkExport({ ...f, stores: odd, checksum: await sha256(JSON.stringify(odd)) })).toEqual({ ok: false, error: 'records' });
    const notList = { notes: {} };
    expect(await checkExport({ ...f, stores: notList, checksum: await sha256(JSON.stringify(notList)) })).toEqual({ ok: false, error: 'records' });
  });
  it('isOralSession accepts only what the simulator can read', () => {
    expect(isOralSession({ id: 'oral@1', at: 1, items: [good] })).toBe(true);
    expect(isOralSession({ id: 'oral@1', at: 1, items: [good, {}] })).toBe(false);
    expect(isOralSession({ at: 1, items: [good] })).toBe(false);
    expect(isOralSession(null)).toBe(false);
  });
});

describe('import trust boundary for every store', () => {
  const fsrs = { due: 1, stability: 2, difficulty: 5, elapsed_days: 0, scheduled_days: 1, learning_steps: 0, reps: 1, lapses: 0, state: 2, last_review: 1 };
  /** One record each store writes, and the ways a crafted one breaks the page that reads it. */
  const cases: { [K in StoreName]: { good: object; bad: object[] } } = {
    cards: {
      good: { entity: 'a', module: 'g01', fsrs, added: 1 },
      bad: [{ entity: 'a', module: 'g01' }, { entity: 'a', module: 'g01', fsrs: { ...fsrs, state: 7 } }, { entity: 'a', module: 'g01', fsrs: { ...fsrs, lapses: undefined } }, { module: 'g01', fsrs }],
    },
    reviewLog: {
      good: { card: 'a:qa:1', entity: 'a', module: 'g01', rating: 3, state: 2, at: 1, confidence: 2 },
      bad: [{ card: 'a:qa:1', entity: 'a', module: 'g01', rating: '3', state: 2, at: 1 }, { card: 'a:qa:1', entity: 'a', module: 'g01', rating: 3, state: 2, at: 1, confidence: 5 }],
    },
    bookmarks: { good: {}, bad: [] },
    notes: { good: { text: 'x' }, bad: [{}, { text: 3 }] },
    highlights: { good: { entity: 'a', section: 'micro', text: 'x' }, bad: [{ entity: 'a', text: 'x' }] },
    errors: { good: { entity: 'a', card: 'a:qa:1' }, bad: [{}, { entity: 'a', card: 1 }] },
    readProgress: { good: { entity: 'a', section: 'micro', at: 1 }, bad: [{ entity: 'a', section: 'micro' }] },
    recent: { good: { names: { it: 'A', en: 'A' }, module: 'g01', at: 1, section: 'micro' }, bad: [{ names: { it: 'A' }, module: 'g01', at: 1 }, { module: 'g01', at: 1 }] },
    quizAttempts: {
      good: { question: 'q', entities: ['a'], module: 'g01', correct: true, mode: 'quick', at: 1, confidence: 1 },
      bad: [{ question: 'q', entities: 'a', module: 'g01', correct: true, mode: 'quick', at: 1 }, { question: 'q', entities: ['a'], module: 'g01', correct: 1, mode: 'quick', at: 1 }],
    },
    plan: { good: { examDate: '2027-01-20', hoursPerWeek: 6 }, bad: [{ examDate: '2027-01-20' }] },
    settings: { good: { value: 1 }, bad: [] },
    oralSessions: { good: { at: 1, items: [{ question: 'a#1', entity: 'a', text: '?', predicted: 3, rubric: { completeness: 3, accuracy: 3, structure: 3, terminology: 3 } }] }, bad: [{ at: 1, items: [] }] },
  };
  for (const store of STORES)
    it(`${store}: keeps what the tools can read, leaves out the rest, and passes tombstones`, () => {
      const { good, bad } = cases[store];
      expect(isImportable(store, { id: 'r', updated: 1, ...good })).toBe(true);
      for (const b of bad) expect(isImportable(store, { id: 'r', updated: 1, ...b }), JSON.stringify(b)).toBe(false);
      expect(isImportable(store, { id: 'r', updated: 1, deleted: true })).toBe(true);
      expect(isImportable(store, { updated: 1, ...good })).toBe(false);
      expect(isImportable(store, { id: 'r', updated: '1', ...good })).toBe(false);
      expect(isImportable(store, null)).toBe(false);
    });
});
