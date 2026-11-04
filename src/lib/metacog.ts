/**
 * Metacognition (pure, unit-tested): how well the learner's confidence matches
 * their results. Confidence is asked before the answer is shown (quiz, review,
 * quick check) and stored with the attempt: 1 = guessing, 2 = fairly sure, 3 = sure.
 */
export const CONFIDENCE = [1, 2, 3] as const;
export type Confidence = (typeof CONFIDENCE)[number];
export const isConfidence = (x: unknown): x is Confidence => x === 1 || x === 2 || x === 3;

/** One judged answer: a quiz or quick-check attempt, or a flashcard review. */
export type Judged = { entities: readonly string[]; confidence?: Confidence; correct: boolean };
export type LevelStat = { level: Confidence; right: number; total: number };

/** Right / total per confidence level (answers without a confidence are ignored). */
export function calibration(items: readonly Judged[]): LevelStat[] {
  const out = CONFIDENCE.map((level) => ({ level, right: 0, total: 0 }));
  for (const i of items) {
    if (!isConfidence(i.confidence)) continue;
    const s = out[i.confidence - 1]!;
    s.total++;
    if (i.correct) s.right++;
  }
  return out;
}

/** Entities ranked by how often an answer at `level` was `correct` (e.g. sure but wrong). */
function byEntity(items: readonly Judged[], level: Confidence, correct: boolean): { entity: string; n: number }[] {
  const n = new Map<string, number>();
  for (const i of items) if (i.confidence === level && i.correct === correct) for (const e of i.entities) n.set(e, (n.get(e) ?? 0) + 1);
  return [...n].map(([entity, k]) => ({ entity, n: k })).sort((a, b) => b.n - a.n || a.entity.localeCompare(b.entity));
}

/** Topics answered wrong while sure: the most useful ones to re-read. */
export const overconfident = (items: readonly Judged[]) => byEntity(items, 3, false);
/** Topics answered right while guessing: knowledge that is not yet secure. */
export const luckyGuesses = (items: readonly Judged[]) => byEntity(items, 1, true);

export const MIN_JUDGED = 10;
export type Advice = 'tooFew' | 'overconfident' | 'underconfident' | 'calibrated';

/**
 * Plain-language verdict. Thresholds are a rough teaching rule, not a
 * statistical test: "sure" should be right at least 3 times in 4, "guessing"
 * should be right no more than 6 times in 10.
 */
export function advice(stats: readonly LevelStat[]): Advice {
  if (stats.reduce((n, s) => n + s.total, 0) < MIN_JUDGED) return 'tooFew';
  const rate = (l: Confidence) => {
    const s = stats[l - 1]!;
    return s.total ? s.right / s.total : undefined;
  };
  const sure = rate(3);
  const guess = rate(1);
  if (sure !== undefined && sure < 0.75) return 'overconfident';
  if (guess !== undefined && guess > 0.6) return 'underconfident';
  return 'calibrated';
}

/** Percentage rounded for display (0 when there is nothing to divide). */
export const pct = (right: number, total: number) => (total ? Math.round((100 * right) / total) : 0);
