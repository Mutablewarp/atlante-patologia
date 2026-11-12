/**
 * Build-time study data: flashcards, questions and the compact study index
 * served as static JSON (/[lang]/data/…). Only visible content is used
 * (published, or drafts with PREVIEW_DRAFTS=1).
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getCollection } from 'astro:content';
import { getImage } from 'astro:assets';
import type { ImageMetadata } from 'astro';
import type { Lang } from '../i18n/index.ts';
import { siteData, entityBody, images as getImages, PREVIEW_DRAFTS } from './content.ts';
import { splitSections } from './sections.ts';
import { fileFor } from './image-meta.ts';
import { clozeCards, qaCards, occlusionCards, type StudyCard, type OcclusionImage } from './cards.ts';
import type { QuizQuestion } from './quiz.ts';
import type { OralQuestion } from './oral.ts';
import { langPath } from './url.ts';
import { sectionTitle } from '../i18n/sections.ts';

// `_` files are fixtures (H04): excluded so they never become production build assets.
const ASSETS = import.meta.glob<ImageMetadata>(['/src/assets/images/*.{png,jpg,jpeg,webp,avif,svg}', '!**/_*'], { import: 'default' });

export type StudyImage = { src: string; width: number; height: number };

/** Optimized URL for an image file under src/assets/images (SVG served as is). */
export async function imageSrc(file: string): Promise<StudyImage | undefined> {
  const name = file.replace(/^.*\//, '');
  const load = ASSETS[`/src/assets/images/${name}`];
  if (!load) return fixtureSrc(name);
  const meta = await load();
  if (meta.format === 'svg') return { src: meta.src, width: meta.width, height: meta.height };
  const width = Math.min(meta.width, 1000);
  const out = await getImage({ src: meta, width, format: 'webp' });
  return { src: out.src, width, height: Math.round((meta.height * width) / meta.width) };
}

/**
 * Draft fixture drawings live in src/assets/fixtures/ and are inlined as data
 * URIs, so they never become build assets (nothing of them reaches a production dist/).
 */
function fixtureSrc(name: string): StudyImage | undefined {
  if (!PREVIEW_DRAFTS) return undefined;
  const path = join(process.cwd(), 'src/assets/fixtures', name);
  if (!name.endsWith('.svg') || !existsSync(path)) return undefined;
  const svg = readFileSync(path, 'utf8');
  const dim = (k: string) => Number(svg.match(new RegExp(`${k}="(\\d+)"`))?.[1] ?? 400);
  return { src: `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`, width: dim('width'), height: dim('height') };
}

const SECTION_FOR_KIND: Record<string, string> = { gross: 'gross', micro: 'micro', diagram: 'pathogenesis', imaging: 'diagnosis', clinical: 'clinical' };
export const sectionForImageKind = (kind: string) => SECTION_FOR_KIND[kind] ?? 'definition';

export async function questions() {
  return (await getCollection('questions', (q) => q.data.status === 'published' || PREVIEW_DRAFTS)).map((q) => q.data);
}

let cardCache: Promise<Map<string, { it: StudyCard[]; en: StudyCard[] }>> | undefined;

/** All cards by module, both languages, generated once per build. */
export function allCards() {
  cardCache ??= (async () => {
    // One pass builds both languages: the cards keep the English syllabus order in both files, as before.
    const { entities } = await siteData('en');
    const imgs = new Map((await getImages()).map((i) => [i.id, i]));
    const byModule = new Map<string, { it: StudyCard[]; en: StudyCard[] }>();
    for (const e of entities) {
      const [en, it] = await Promise.all([entityBody(e.id, 'en'), entityBody(e.id, 'it')]);
      const hy = (b: typeof en) => splitSections(b?.rendered?.html ?? '').sections.get('high-yield') ?? '';
      const occ: OcclusionImage[] = [];
      for (const ref of e.images) {
        const img = imgs.get(ref.id);
        if (!img || !img.annotations.length) continue;
        // shortcut: occlusion cards share one drawing across languages; an Italian copy (`fileIt`) is not used here, add it if a labelled diagram ever needs one.
        const src = await imageSrc(img.file);
        if (src) occ.push({ id: img.id, ...src, alt: img.alt, caption: img.caption, section: sectionForImageKind(ref.role), annotations: img.annotations });
      }
      const parts = [
        clozeCards({ entity: e.id, module: e.module, html: { en: hy(en), it: hy(it) } }),
        qaCards({ entity: e.id, module: e.module, quickCheck: e.quickCheck }),
        occlusionCards(e.id, e.module, occ),
      ];
      const acc = byModule.get(e.module) ?? { it: [], en: [] };
      for (const p of parts) {
        acc.it.push(...p.it);
        acc.en.push(...p.en);
      }
      byModule.set(e.module, acc);
    }
    return byModule;
  })();
  return cardCache;
}

export async function questionsFor(module: string, lang: Lang): Promise<QuizQuestion[]> {
  const { entityById } = await siteData(lang);
  const imgs = new Map((await getImages()).map((i) => [i.id, i]));
  const out: QuizQuestion[] = [];
  for (const q of (await questions()).filter((x) => x.module === module)) {
    const target = entityById.get(q.backLink.entity);
    const img = q.image ? imgs.get(q.image) : undefined;
    const src = img ? await imageSrc(fileFor(img, lang)) : undefined;
    out.push({
      id: q.id,
      module: q.module,
      entities: q.entities,
      kind: q.kind,
      difficulty: q.difficulty,
      stem: q.stem[lang],
      options: q.options.map((o) => ({ id: o.id, text: o.text[lang], correct: o.correct, why: o.why[lang] })),
      ...(q.answer ? { answer: q.answer[lang] } : {}),
      ...(img && src ? { image: { ...src, alt: img.alt[lang] } } : {}),
      ...(target
        ? { back: { href: langPath(lang, `e/${target.id}/#${q.backLink.section}`), label: `${target.names[lang]} · ${sectionTitle(q.backLink.section, target.kind, lang)}` } }
        : {}),
    });
  }
  return out;
}

export type StudyIndex = {
  modules: { id: string; label: string; section: 'I' | 'II' | 'III'; order: number; cards: number; questions: number }[];
  entities: { id: string; name: string; module: string; tier: 'core' | 'extended'; cards: string[] }[];
};

/** Compact index used by every study island (/[lang]/data/study.json). */
export async function studyIndex(lang: Lang): Promise<StudyIndex> {
  const { modules, entities } = await siteData(lang);
  const cards = await allCards();
  const qs = await questions();
  const ents = entities.map((e) => ({
    id: e.id,
    name: e.names[lang],
    module: e.module,
    tier: e.tier,
    cards: (cards.get(e.module)?.[lang] ?? []).filter((c) => c.entity === e.id).map((c) => c.id),
  }));
  return {
    modules: modules
      .filter((m) => ents.some((e) => e.module === m.id))
      .map((m) => ({
        id: m.id,
        label: m.label[lang],
        section: m.section,
        order: m.order,
        cards: cards.get(m.id)?.[lang].length ?? 0,
        questions: qs.filter((q) => q.module === m.id).length,
      })),
    entities: ents,
  };
}

/** Every possible exam question of the visible entities (/[lang]/data/oral.json, oral simulator). */
export async function oralQuestions(lang: Lang): Promise<OralQuestion[]> {
  const { entities } = await siteData(lang);
  return entities.flatMap((e) =>
    // `?? []`: a content cache written before examQuestions existed (node_modules/.astro) lacks the default.
    (e.examQuestions ?? []).map((q, i) => ({
      id: `${e.id}#${i + 1}`,
      entity: e.id,
      name: e.names[lang],
      module: e.module,
      level: q.level,
      text: q[lang],
      focus: q.focus.map((s) => ({ id: s, label: sectionTitle(s, e.kind, lang), href: langPath(lang, `e/${e.id}/#${s}`) })),
    })),
  );
}
