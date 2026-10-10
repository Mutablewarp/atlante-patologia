import { defineCollection } from 'astro:content';
import { glob, file } from 'astro/loaders';
import {
  entitySchema,
  entityBodySchema,
  patternSchema,
  questionSchema,
  imageSchema,
  glossarySchema,
  pathSchema,
  taxonomySchema,
  moduleSchema,
  sourceSchema,
} from './lib/schema.ts';

const C = './src/content';

/** Folder name of an entry without a leading underscore (fixtures live in `_name/`). */
const folderOf = (entry: string) => entry.split('/')[0]!.replace(/^_/, '');
/** id from the data's own `id` field; falls back to the folder/file name. */
const idFromData = ({ entry, data }: { entry: string; data: Record<string, unknown> }) =>
  typeof data.id === 'string' ? data.id : folderOf(entry);
/** Markdown bodies: `<entity-id>/<lang>` so pages can look them up directly. */
const bodyId = ({ entry }: { entry: string }) => `${folderOf(entry)}/${entry.split('/').at(-1)!.replace(/\.md$/, '')}`;

export const collections = {
  entities: defineCollection({
    loader: glob({ base: `${C}/entities`, pattern: '*/meta.yaml', generateId: idFromData }),
    schema: entitySchema,
  }),
  entityBodies: defineCollection({
    loader: glob({ base: `${C}/entities`, pattern: '*/{en,it}.md', generateId: bodyId }),
    schema: entityBodySchema,
  }),
  patterns: defineCollection({
    loader: glob({ base: `${C}/patterns`, pattern: '*/meta.yaml', generateId: idFromData }),
    schema: patternSchema,
  }),
  patternBodies: defineCollection({
    loader: glob({ base: `${C}/patterns`, pattern: '*/{en,it}.md', generateId: bodyId }),
    schema: entityBodySchema,
  }),
  questions: defineCollection({
    loader: glob({ base: `${C}/questions`, pattern: '*/*.yaml', generateId: idFromData }),
    schema: questionSchema,
  }),
  images: defineCollection({
    loader: glob({ base: `${C}/images`, pattern: '*.yaml', generateId: idFromData }),
    schema: imageSchema,
  }),
  glossary: defineCollection({
    loader: glob({ base: `${C}/glossary`, pattern: '*.yaml', generateId: idFromData }),
    schema: glossarySchema,
  }),
  paths: defineCollection({
    loader: glob({ base: `${C}/paths`, pattern: '*.yaml', generateId: idFromData }),
    schema: pathSchema,
  }),
  taxonomy: defineCollection({
    loader: glob({ base: `${C}/taxonomy`, pattern: '*.yaml', generateId: ({ data }) => String(data.lens) }),
    schema: taxonomySchema,
  }),
  modules: defineCollection({ loader: file(`${C}/modules.yaml`), schema: moduleSchema }),
  sources: defineCollection({ loader: file(`${C}/sources.yaml`), schema: sourceSchema }),
};
