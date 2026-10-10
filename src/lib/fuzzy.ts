/** Tiny fuzzy matcher for the command palette (accent- and case-insensitive). */

export const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

/**
 * Score of `query` against `text` (already folded); 0 = no match.
 * Substring matches win (word-start best); otherwise an in-order subsequence,
 * rewarded for consecutive characters.
 */
export function fuzzyScore(query: string, text: string): number {
  if (!query) return 0;
  const i = text.indexOf(query);
  if (i === 0) return 1000 - text.length;
  if (i > 0) return (/[\s\-(/]/.test(text[i - 1]!) ? 800 : 600) - text.length;
  let score = 0;
  let run = 0;
  let pos = -1;
  for (const ch of query) {
    if (ch === ' ') continue;
    const next = text.indexOf(ch, pos + 1);
    if (next === -1) return 0;
    run = next === pos + 1 ? run + 1 : 0;
    score += 1 + run * 2;
    pos = next;
  }
  return Math.min(score * 10, 500) - text.length;
}

/** Best score over several (folded) keys. */
export function bestScore(query: string, keys: readonly string[]): number {
  let best = 0;
  for (const k of keys) best = Math.max(best, fuzzyScore(query, k));
  return best;
}
