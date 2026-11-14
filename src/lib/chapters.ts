/**
 * Chapters: the modules that have at least one published card. The chapter pages (`/{lang}/chapter/{id}/`), the chapter
 * index in the sidebar and the links on the home page and in the atlas all come from this one list, so a link to a chapter
 * always has a page to land on. A chapter appears with its first published card and keeps its place in the syllabus order.
 */
import type { Lang } from '../i18n/index.ts';
import type { SiteData } from './content.ts';
import { langPath } from './url.ts';

export type Chapter = SiteData['modules'][number] & {
  /** The published cards, in syllabus order (`SiteData.entities` is already sorted that way, in the page language). */
  cards: SiteData['entities'];
  /** Published cards plus the ones still planned. Only this count is shown, never the planned names. */
  total: number;
};

export function chaptersOf(data: Pick<SiteData, 'modules' | 'entities'>): Chapter[] {
  return data.modules
    .map((m) => {
      const cards = data.entities.filter((e) => e.module === m.id);
      return { ...m, cards, total: cards.length + m.planned.length };
    })
    .filter((c) => c.cards.length > 0);
}

export const chapterHref = (lang: Lang, id: string): string => langPath(lang, `chapter/${id}/`);
