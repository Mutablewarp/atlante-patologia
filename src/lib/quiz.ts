/**
 * Quiz selection helpers (pure). Questions come from
 * /[lang]/data/questions/<module>.json; attempts from the learner's DB.
 */
export type QuizOption = { id: string; text: string; correct: boolean; why: string };
export type QuizQuestion = {
  id: string;
  module: string;
  entities: string[];
  kind: 'mcq' | 'short' | 'image-spot';
  difficulty: 1 | 2 | 3;
  stem: string;
  options: QuizOption[];
  answer?: string;
  image?: { src: string; width: number; height: number; alt: string };
  /** Back-link to the entity section; absent when the entity is not published. */
  back?: { href: string; label: string };
};
export type Attempt = { question: string; entities: string[]; correct: boolean; at: number };

export function shuffle<T>(items: readonly T[], rand: () => number = Math.random): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/** Interleave: round-robin across entities so consecutive questions change topic. */
export function interleave<T extends { entities: string[] }>(items: readonly T[]): T[] {
  const groups = new Map<string, T[]>();
  for (const q of items) {
    const k = q.entities[0] ?? '';
    groups.set(k, [...(groups.get(k) ?? []), q]);
  }
  const lists = [...groups.values()];
  const out: T[] = [];
  for (let i = 0; out.length < items.length; i++) for (const l of lists) if (l[i]) out.push(l[i]!);
  return out;
}

/** Accuracy per entity from attempts (latest attempt per question counts). */
export function entityAccuracy(attempts: readonly Attempt[]): Map<string, { right: number; total: number }> {
  const latest = new Map<string, Attempt>();
  for (const a of attempts) if ((latest.get(a.question)?.at ?? -1) < a.at) latest.set(a.question, a);
  const acc = new Map<string, { right: number; total: number }>();
  for (const a of latest.values())
    for (const e of a.entities) {
      const x = acc.get(e) ?? { right: 0, total: 0 };
      x.total++;
      if (a.correct) x.right++;
      acc.set(e, x);
    }
  return acc;
}

/** Weak areas: questions last answered wrong, or about an entity under 70 % accuracy. */
export function weakQuestions<T extends { id: string; entities: string[] }>(questions: readonly T[], attempts: readonly Attempt[]): T[] {
  const acc = entityAccuracy(attempts);
  const lastWrong = new Set<string>();
  const latest = new Map<string, Attempt>();
  for (const a of attempts) if ((latest.get(a.question)?.at ?? -1) < a.at) latest.set(a.question, a);
  for (const a of latest.values()) if (!a.correct) lastWrong.add(a.question);
  const weakEntity = (e: string) => {
    const x = acc.get(e);
    return !!x && x.right / x.total < 0.7;
  };
  return questions.filter((q) => lastWrong.has(q.id) || q.entities.some(weakEntity));
}
