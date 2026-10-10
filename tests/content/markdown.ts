/** Markdown helpers for the content gates: frontmatter, H2 titles, claim markers, numeric sentences. */
import { parse } from 'yaml';

const FRONT = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;
const MARKER = /<!--\s*c:([^\s>]+?)\s*-->/g;
const FENCE = /^```[\s\S]*?^```/gm;

export function splitFrontmatter(raw: string): { data: unknown; body: string } {
  const m = raw.match(FRONT);
  return m ? { data: parse(m[1]!), body: raw.slice(m[0].length) } : { data: null, body: raw };
}

/** H2 titles in document order (fenced code ignored). */
export function h2Titles(body: string): string[] {
  return [...body.replace(FENCE, '').matchAll(/^##[ \t]+(.+?)[ \t#]*$/gm)].map((m) => m[1]!.trim());
}

/** Claim ids from `<!--c:ID-->` markers. */
export function claimMarkers(body: string): Set<string> {
  return new Set([...body.matchAll(MARKER)].map((m) => m[1]!));
}

// A digit followed by %, or a number (or range) followed by a unit of time or measure.
// shortcut: heuristic unit list, extend it when content uses new units (e.g. mmol/L, IU).
const NUMERIC =
  /\d+(?:[.,]\d+)?\s*%|\b\d+(?:[.,]\d+)?(?:\s*[-–]\s*\d+(?:[.,]\d+)?)?\s*(?:years?|anni|anno|months?|mesi|mese|weeks?|settimane|settimana|days?|giorni|giorno|hours?|ore|mmHg|mm|cm|µm|μm|nm|kg|mg|µg|μg|g|dL|mL|L|mmol|mEq)(?![\p{L}\p{N}])/u;
const OPEN = '⟦'; // ⟦ marker sentinel
const CLOSE = '⟧'; // ⟧

/** Sentences of `body` (outside headings and code) that state a number but do not end with a claim marker. */
export function unmarkedNumericSentences(body: string): string[] {
  const text = body
    .replace(FENCE, '')
    .replace(/<!--(?!\s*c:)[\s\S]*?-->/g, ' ') // ordinary comments
    .replace(MARKER, (_, id: string) => `${OPEN}${id}${CLOSE}`)
    .replace(/<\/?[a-z][^>]*>/gi, ' '); // html tags (asides etc.)

  const pieces = text
    .split(/\n\s*\n|\n(?=[ \t]*(?:[-*+][ \t]|\d+[.)][ \t]|\||#))/)
    .flatMap((block) => {
      const b = block.trim();
      if (!b || b.startsWith('#')) return [];
      if (b.startsWith('|')) return b.split('|').filter((c) => !/^[\s:-]*$/.test(c)); // table cells, no separator rows
      return [b.replace(/^(?:[-*+]|\d+[.)])[ \t]+/, '')];
    });

  const out: string[] = [];
  for (const piece of pieces) {
    const glued = piece.replace(/\s+/g, ' ').replace(new RegExp(`\\s+${OPEN}`, 'g'), OPEN).trim();
    for (const s of glued.split(new RegExp(`(?<=[.!?…]|${CLOSE})\\s+`))) {
      if (!NUMERIC.test(s.replace(new RegExp(`${OPEN}[^${CLOSE}]*${CLOSE}`, 'g'), ''))) continue;
      if (!new RegExp(`${CLOSE}[\\s.!?;:,)»"'*_]*$`).test(s)) out.push(s);
    }
  }
  return out;
}
