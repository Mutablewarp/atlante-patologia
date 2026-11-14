/**
 * Interactive body (plan/v3-plan.md §8.2): the organs a card sits in and the cards an organ holds. Pure, no UI.
 * A card's organs are its `sites`; a card without `sites` takes the organs of its `system` lens terms, where
 * `general` and `systemic` own none (CONTENT_SCHEMA §6a).
 */
import { NO_ORGAN_SYSTEMS, type Organ } from './schema.ts';

type OrganRef = Pick<Organ, 'id' | 'system'>;
/** The part of an entity these functions read (an `Entity` fits). */
export type AnatomyCard = {
  id: string;
  status: 'draft' | 'published';
  lenses: { system: readonly string[] };
  sites?: readonly { organ: string; claim?: string }[];
};

/** Organs of a card: its `sites` in their order (a repeated or unknown organ is skipped), else the organs of its system terms in anatomy order. */
export function organsOfCard<O extends OrganRef>(entity: Pick<AnatomyCard, 'lenses' | 'sites'>, anatomy: readonly O[]): O[] {
  if (entity.sites?.length) {
    const byId = new Map(anatomy.map((o) => [o.id, o] as const));
    return [...new Set(entity.sites.map((s) => s.organ))].flatMap((id) => byId.get(id) ?? []);
  }
  const systems = new Set(entity.lenses.system.filter((s) => !NO_ORGAN_SYSTEMS.includes(s)));
  return anatomy.filter((o) => systems.has(o.system));
}

/** The published cards that sit in an organ, in the order given. */
export function cardsOfOrgan<C extends AnatomyCard>(organId: string, entities: readonly C[], anatomy: readonly OrganRef[]): C[] {
  return entities.filter((e) => e.status === 'published' && organsOfCard(e, anatomy).some((o) => o.id === organId));
}

/** Module -> system term, for the planned cards (they have no organ yet). Explicit: module order and system order are not the same list. */
export const MODULE_SYSTEM: Readonly<Record<string, string>> = {
  o16: 'vessels',
  o17: 'heart',
  o18: 'respiratory',
  o19: 'gastrointestinal',
  o20: 'liver-biliary',
  o21: 'pancreas',
  o22: 'kidney',
  o23: 'urinary-male-genital',
  o24: 'female-genital',
  o25: 'breast',
  o26: 'hematolymphoid',
  o27: 'endocrine',
  o28: 'skin',
  o29: 'head-neck',
  o30: 'bone-soft-tissue',
  o31: 'muscle-nerve',
  o32: 'cns',
  o33: 'eye',
};

type Bilingual = { it: string; en: string };
type Term = { id: string; order: number; label: Bilingual };
type TreeCard = AnatomyCard & { names: Bilingual; lenses: { system: readonly string[]; process: readonly string[] } };
type TreeOrgan = OrganRef & { order: number; label: Bilingual };
type TreeModule = { id: string; planned: readonly { id: string; names: Bilingual }[] };
type CardLink = { id: string; name: string };
export type BodyTree = {
  systems: {
    id: string;
    label: string;
    count: number;
    organs: { id: string; label: string; count: number; groups: { process: string; label: string; cards: CardLink[] }[] }[];
    planned: CardLink[];
  }[];
  unplaced: number;
};

/** The page of docs/BODY_SPEC.md §5 as data: system > organ > process group > card. A card with several processes sits in the first one. */
export function bodyTree(input: {
  entities: readonly TreeCard[];
  anatomy: readonly TreeOrgan[];
  systems: readonly Term[];
  processes: readonly Term[];
  modules: readonly TreeModule[];
  lang: 'it' | 'en';
}): BodyTree {
  const { entities, anatomy, systems, processes, modules, lang } = input;
  const byOrder = <T extends { order: number }>(list: readonly T[]) => [...list].sort((a, b) => a.order - b.order);
  const processTerms = byOrder(processes);
  const processIndex = new Map(processTerms.map((p, i) => [p.id, i] as const));
  const published = entities.filter((e) => e.status === 'published');
  const publishedIds = new Set(published.map((e) => e.id));
  const link = (e: TreeCard): CardLink => ({ id: e.id, name: e.names[lang] });

  const unplaced = published.filter((e) => organsOfCard(e, anatomy).length === 0).length;

  // Groups follow the order of the process terms; cards without a process close the list.
  const groupsOf = (cards: TreeCard[]) => {
    const groups = new Map<string, CardLink[]>();
    for (const card of cards) {
      const process = card.lenses.process[0] ?? '';
      groups.set(process, [...(groups.get(process) ?? []), link(card)]);
    }
    const rank = (p: string) => (p === '' ? Number.MAX_SAFE_INTEGER : (processIndex.get(p) ?? Number.MAX_SAFE_INTEGER - 1));
    return [...groups]
      .sort(([a], [b]) => rank(a) - rank(b))
      .map(([process, list]) => ({ process, label: processTerms.find((p) => p.id === process)?.label[lang] ?? '', cards: list }));
  };

  return {
    systems: byOrder(systems)
      .filter((s) => !NO_ORGAN_SYSTEMS.includes(s.id))
      .map((s) => {
        const organs = byOrder(anatomy.filter((o) => o.system === s.id)).map((o) => {
          const cards = cardsOfOrgan(o.id, published, anatomy);
          return { id: o.id, label: o.label[lang], count: cards.length, groups: groupsOf(cards), ids: cards.map((c) => c.id) };
        });
        const planned = modules
          .filter((m) => MODULE_SYSTEM[m.id] === s.id)
          .flatMap((m) => m.planned)
          .filter((p) => !publishedIds.has(p.id))
          .map((p) => ({ id: p.id, name: p.names[lang] }));
        return {
          id: s.id,
          label: s.label[lang],
          count: new Set(organs.flatMap((o) => o.ids)).size,
          organs: organs.map(({ ids: _ids, ...o }) => o),
          planned,
        };
      }),
    unplaced,
  };
}
