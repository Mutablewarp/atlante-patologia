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
