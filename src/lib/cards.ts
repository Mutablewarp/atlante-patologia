/**
 * Flashcard generation (CONTENT_SCHEMA §7). Pure functions: no Astro imports,
 * so Vitest can run them. Cards are generated at build, never hand-authored.
 *
 * Card id = `<entity>:<kind>:<sha1(en source text)[0:10]>`, shared by both
 * languages so review history survives a language switch. Editing the English
 * source creates a new card id (the old history stays in the learner's DB).
 */
import { createHash } from 'node:crypto';

export type CardKind = 'cloze' | 'qa' | 'occlusion';
type L = { it: string; en: string };

export type Shape = { type: 'circle' | 'rect' | 'polygon'; coords: number[] };

/** One card in one language, as served by /[lang]/data/cards/<module>.json. */
export type StudyCard = {
  id: string;
  entity: string;
  module: string;
  kind: CardKind;
  /** HTML (escaped at build). */
  front: string;
  back: string;
  /** Section anchor the card comes from (back-link). */
  section: string;
  image?: { src: string; avifSet?: string; width: number; height: number; alt: string; shapes: Shape[]; target: number };
};

export function cardId(entity: string, kind: CardKind, enSource: string): string {
  return `${entity}:${kind}:${createHash('sha1').update(enSource).digest('hex').slice(0, 10)}`;
}

export const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const stripComments = (html: string) => html.replace(/<!--[\s\S]*?-->/g, '');
const stripTags = (html: string) => stripComments(html).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

/** Top-level `<li>` bodies of the lists in a section's HTML (nested lists stay inside their item). */
export function listItems(html: string): string[] {
  const out: string[] = [];
  const re = /<(\/?)(li|ul|ol)\b[^>]*>/gi;
  let depth = 0;
  let start = -1;
  for (const m of stripComments(html).matchAll(re)) {
    const closing = m[1] === '/';
    const tag = m[2]!.toLowerCase();
    if (tag !== 'li') continue;
    if (!closing) {
      if (depth === 0) start = m.index! + m[0].length;
      depth++;
    } else {
      depth--;
      if (depth === 0 && start >= 0) out.push(m.input!.slice(start, m.index).trim());
    }
  }
  return out;
}

const STRONG = /<strong>([\s\S]*?)<\/strong>/g;
const boldTerms = (li: string) => [...li.matchAll(STRONG)].map((m) => m[1]!);

/** Replace the n-th `<strong>` of an item. */
function replaceNth(li: string, n: number, fn: (inner: string) => string): string {
  let i = -1;
  return li.replace(STRONG, (whole, inner: string) => (++i === n ? fn(inner) : whole));
}

export type ClozeInput = { entity: string; module: string; html: L };

/**
 * One cloze card per bold term per high-yield bullet. EN and IT bullets are
 * aligned by position and must have the same number of bold terms (parity).
 */
export function clozeCards({ entity, module, html }: ClozeInput): { it: StudyCard[]; en: StudyCard[] } {
  const en = listItems(html.en);
  const it = listItems(html.it);
  if (en.length !== it.length)
    throw new Error(`${entity}: high-yield has ${en.length} bullets in en.md but ${it.length} in it.md`);
  const out = { it: [] as StudyCard[], en: [] as StudyCard[] };
  en.forEach((enLi, b) => {
    const itLi = it[b]!;
    const nEn = boldTerms(enLi).length;
    const nIt = boldTerms(itLi).length;
    if (nEn !== nIt)
      throw new Error(`${entity}: high-yield bullet ${b + 1} has ${nEn} bold terms in en.md but ${nIt} in it.md`);
    for (let n = 0; n < nEn; n++) {
      const id = cardId(entity, 'cloze', stripTags(replaceNth(enLi, n, (t) => `{{${t}}}`)));
      for (const [lang, li] of [['en', enLi], ['it', itLi]] as const) {
        out[lang].push({
          id,
          entity,
          module,
          kind: 'cloze',
          front: replaceNth(li, n, () => '<span class="cloze-gap">[…]</span>'),
          back: replaceNth(li, n, (t) => `<mark>${t}</mark>`),
          section: 'high-yield',
        });
      }
    }
  });
  return out;
}

export type QaInput = { entity: string; module: string; quickCheck: { q: L; a: L }[] };

export function qaCards({ entity, module, quickCheck }: QaInput): { it: StudyCard[]; en: StudyCard[] } {
  const out = { it: [] as StudyCard[], en: [] as StudyCard[] };
  for (const { q, a } of quickCheck) {
    const id = cardId(entity, 'qa', `${q.en}\n${a.en}`);
    for (const lang of ['it', 'en'] as const)
      out[lang].push({ id, entity, module, kind: 'qa', front: escapeHtml(q[lang]), back: escapeHtml(a[lang]), section: 'quick-check' });
  }
  return out;
}

export type OcclusionImage = {
  id: string;
  src: string;
  avifSet?: string;
  width: number;
  height: number;
  alt: L;
  caption: L;
  /** Entity section the image illustrates (gross, micro…), for the back-link. */
  section: string;
  annotations: { id: string; label: L; revealOrder: number; shape: Shape }[];
};

/** One card per annotation: the image with that label hidden. */
export function occlusionCards(entity: string, module: string, images: OcclusionImage[]): { it: StudyCard[]; en: StudyCard[] } {
  const out = { it: [] as StudyCard[], en: [] as StudyCard[] };
  for (const img of images) {
    const anns = [...img.annotations].sort((a, b) => a.revealOrder - b.revealOrder);
    anns.forEach((ann, target) => {
      const id = cardId(entity, 'occlusion', `${img.id}\n${ann.id}\n${ann.label.en}`);
      for (const lang of ['it', 'en'] as const)
        out[lang].push({
          id,
          entity,
          module,
          kind: 'occlusion',
          front: '',
          back: `<strong>${escapeHtml(ann.label[lang])}</strong><br>${escapeHtml(img.caption[lang])}`,
          section: img.section,
          image: { src: img.src, ...(img.avifSet ? { avifSet: img.avifSet } : {}), width: img.width, height: img.height, alt: img.alt[lang], shapes: anns.map((a) => a.shape), target },
        });
    });
  }
  return out;
}
