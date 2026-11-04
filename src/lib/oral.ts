/**
 * Oral exam simulator (pure, unit-tested). Questions come from the entities'
 * `examQuestions` via /[lang]/data/oral.json; sessions are saved locally.
 * Scores use one 1–4 scale: the learner predicts a score before the
 * self-assessment, then rates four rubric criteria.
 */
export type OralFocus = { id: string; label: string; href: string };
export type OralQuestion = {
  /** `<entity>#<n>`, n = position in the entity's examQuestions (1-based). */
  id: string;
  entity: string;
  name: string;
  module: string;
  level: 1 | 2 | 3;
  text: string;
  focus: OralFocus[];
};

export const RUBRIC = ['completeness', 'accuracy', 'structure', 'terminology'] as const;
export type Criterion = (typeof RUBRIC)[number];
export type Score = 1 | 2 | 3 | 4;
export const SCORES: readonly Score[] = [1, 2, 3, 4];
export type Rubric = Record<Criterion, Score>;

export type OralItem = { question: string; entity: string; text: string; predicted: Score; rubric: Rubric; seconds?: number };
export type OralSession = { id: string; at: number; items: OralItem[] };

export const SESSION_SIZE = 3;

const isScore = (x: unknown): x is Score => x === 1 || x === 2 || x === 3 || x === 4;
/** Shape check for a stored or imported oral item: question text, a predicted score and all four rubric scores. */
export function isOralItem(x: unknown): x is OralItem {
  const i = x as Partial<OralItem> | null;
  return (
    !!i &&
    typeof i.question === 'string' &&
    typeof i.text === 'string' &&
    isScore(i.predicted) &&
    !!i.rubric &&
    typeof i.rubric === 'object' &&
    RUBRIC.every((c) => isScore((i.rubric as Partial<Rubric>)[c]))
  );
}

/**
 * Draw `n` questions spread across chapters (round-robin over shuffled
 * modules) with one question per entity; only when there are fewer entities
 * than `n` does an entity get a second question.
 */
export function drawQuestions(pool: readonly OralQuestion[], n = SESSION_SIZE, rand: () => number = Math.random): OralQuestion[] {
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
  }
  const byModule = new Map<string, OralQuestion[]>();
  for (const q of shuffled) byModule.set(q.module, [...(byModule.get(q.module) ?? []), q]);
  const lists = [...byModule.values()];
  const out: OralQuestion[] = [];
  const used = new Set<string>();
  for (let progress = true; out.length < n && progress; ) {
    progress = false;
    for (const l of lists) {
      if (out.length >= n) break;
      const k = l.findIndex((q) => !used.has(q.entity));
      if (k < 0) continue;
      const [q] = l.splice(k, 1);
      used.add(q!.entity);
      out.push(q!);
      progress = true;
    }
  }
  const rest = shuffled.filter((q) => !out.includes(q));
  return [...out, ...rest.slice(0, Math.max(0, n - out.length))];
}

/** Mean of the four rubric criteria (1–4). */
export const rubricMean = (r: Rubric) => RUBRIC.reduce((n, c) => n + r[c], 0) / RUBRIC.length;

export type OralBias = 'tooFew' | 'over' | 'under' | 'calibrated';
/** Items needed before the predicted-vs-assessed verdict means anything. */
export const MIN_ORAL_ITEMS = 3;

/** Predicted minus self-assessed, averaged over items (positive = you expected more). */
export function oralCalibration(items: readonly OralItem[]): { n: number; predicted: number; assessed: number; gap: number; bias: OralBias } {
  const n = items.length;
  const predicted = n ? items.reduce((s, i) => s + i.predicted, 0) / n : 0;
  const assessed = n ? items.reduce((s, i) => s + rubricMean(i.rubric), 0) / n : 0;
  const gap = predicted - assessed;
  // Half a point on a 1–4 scale: one criterion level in two.
  const bias: OralBias = n < MIN_ORAL_ITEMS ? 'tooFew' : gap > 0.5 ? 'over' : gap < -0.5 ? 'under' : 'calibrated';
  return { n, predicted, assessed, gap, bias };
}
