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
/** Answers needed at one confidence level before its hit rate can drive a verdict. */
export const MIN_PER_LEVEL = 5;
/** Share of the answers at one level from which "you almost always chose the same level" is true. */
export const ONE_LEVEL_SHARE = 0.8;
export type Advice = 'tooFew' | 'overconfident' | 'fairlyWrong' | 'underconfident' | 'oneLevel' | 'notRising' | 'calibrated';

/**
 * Plain-language verdict. Thresholds are a rough teaching rule, not a
 * statistical test: "sure" should be right at least 3 times in 4, "fairly
 * sure" at least 1 time in 2, "guessing" no more than 6 times in 10. A level
 * counts only with at least MIN_PER_LEVEL answers, and "calibrated" needs two
 * such levels to compare. Without them the verdict is 'oneLevel' when one
 * level holds ONE_LEVEL_SHARE of the answers, otherwise 'tooFew'.
 * 'notRising': a higher level is right less often than a lower one, or most
 * "sure" answers are wrong while the guesses are right (however few they are).
 */
export function advice(stats: readonly LevelStat[]): Advice {
  const total = stats.reduce((n, s) => n + s.total, 0);
  if (total < MIN_JUDGED) return 'tooFew';
  const rate = (l: Confidence) => {
    const s = stats[l - 1]!;
    return s.total >= MIN_PER_LEVEL ? s.right / s.total : undefined;
  };
  const [guess, fair, sure] = CONFIDENCE.map(rate);
  if (sure !== undefined && sure < 0.75) return 'overconfident';
  if (fair !== undefined && fair < 0.5) return 'fairlyWrong';
  if (guess !== undefined && guess > 0.6) {
    const s = stats[2]!;
    return s.right * 2 < s.total ? 'notRising' : 'underconfident';
  }
  const rates = [guess, fair, sure].filter((r): r is number => r !== undefined);
  if (rates.length < 2) return Math.max(...stats.map((s) => s.total)) >= ONE_LEVEL_SHARE * total ? 'oneLevel' : 'tooFew';
  // From less to more confident, accuracy must never fall.
  return rates.some((r, i) => rates.slice(i + 1).some((higher) => higher < r)) ? 'notRising' : 'calibrated';
}

/** Percentage rounded for display (0 when there is nothing to divide). */
export const pct = (right: number, total: number) => (total ? Math.round((100 * right) / total) : 0);
