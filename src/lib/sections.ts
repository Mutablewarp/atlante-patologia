/**
 * Split a rendered entity body (HTML from the Markdown processor) into the
 * canonical sections of CONTENT_SCHEMA §1b, keyed by language-neutral anchor.
 * Done on the HTML string so it works with any Astro Markdown processor.
 */
import { sectionIdForTitle } from '../i18n/sections.ts';

export type SplitBody = {
  /** HTML before the first H2 (normally empty or comments). */
  preamble: string;
  /** anchor id → section body HTML (without its H2). */
  sections: Map<string, string>;
  /** H2 titles that are not canonical (a validator should reject them). */
  unknown: string[];
};

const H2 = /<h2\b[^>]*>([\s\S]*?)<\/h2>/gi;
const stripTags = (s: string) =>
  s
    .replace(/<[^>]+>/g, '')
    .replace(/&#x27;|&#39;|&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/[’]/g, "'")
    .trim();

export function splitSections(html: string): SplitBody {
  const sections = new Map<string, string>();
  const unknown: string[] = [];
  const matches = [...html.matchAll(H2)];
  const preamble = html.slice(0, matches[0]?.index ?? html.length);

  matches.forEach((m, i) => {
    const start = m.index! + m[0].length;
    const end = matches[i + 1]?.index ?? html.length;
    const title = stripTags(m[1] ?? '');
    const def = sectionIdForTitle(title);
    if (def) sections.set(def.id, html.slice(start, end).trim());
    else unknown.push(title);
  });
  return { preamble, sections, unknown };
}
