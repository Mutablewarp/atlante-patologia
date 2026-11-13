/**
 * Build-time access to pathways and their PDB structures (O9). Pathways follow
 * the same visibility rule as entities: `published`, or drafts with PREVIEW_DRAFTS=1.
 */
import { getCollection } from 'astro:content';
import { PREVIEW_DRAFTS } from './content.ts';
import { dropClaimMarkers } from './crosslinks.ts';
import type { Pathway, Structure } from './schema.ts';

export async function pathways(): Promise<Pathway[]> {
  return (await getCollection('pathways', (p) => p.data.status === 'published' || PREVIEW_DRAFTS)).map((p) => p.data);
}

export async function structureById(): Promise<Map<string, Structure>> {
  return new Map((await getCollection('structures')).map((s) => [s.data.id, s.data]));
}

const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Step text as HTML: plain text escaped, claim markers dropped (as in entity bodies). */
export function stepHtml(text: string): string {
  return escape(dropClaimMarkers(text));
}

/** Claim ids in a step text, in order. */
export function claimIds(text: string): string[] {
  return [...text.matchAll(/<!--\s*c:([a-z0-9-]+)\s*-->/g)].map((m) => m[1]!);
}

/** What <ap-structure> needs per step (serialised as JSON into the page). */
export type ViewerStep = {
  title: string;
  structure?: string;
  file?: string;
  coarse?: boolean;
  show?: string[];
  highlight?: { chains?: string[]; resi?: string; resn?: string[]; label: string };
};

export function viewerSteps(p: Pathway, structures: Map<string, Structure>, lang: 'it' | 'en'): ViewerStep[] {
  return p.steps.map((s) => {
    const st = s.structure ? structures.get(s.structure) : undefined;
    if (s.structure && !st) throw new Error(`pathway ${p.id}: unknown structure "${s.structure}"`);
    return {
      title: s.title[lang],
      ...(st ? { structure: st.id, file: st.file, coarse: st.coarse, ...(st.show ? { show: st.show } : {}) } : {}),
      ...(s.highlight ? { highlight: { ...s.highlight, label: s.highlight.label[lang] } } : {}),
    };
  });
}
