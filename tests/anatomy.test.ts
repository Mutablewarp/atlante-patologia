import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { cardsOfOrgan, organsOfCard, type AnatomyCard } from '../src/lib/anatomy.ts';
import { anatomySchema, entitySchema } from '../src/lib/schema.ts';

const organ = (id: string, system: string) => ({ id, system });
const anatomy = [organ('aorta', 'vessels'), organ('heart', 'heart'), organ('heart-valves', 'heart'), organ('lung', 'respiratory'), organ('kidney', 'kidney')];
const card = (id: string, system: string[], sites?: AnatomyCard['sites'], status: AnatomyCard['status'] = 'published'): AnatomyCard => ({
  id,
  status,
  lenses: { system },
  ...(sites ? { sites } : {}),
});
const ids = (list: { id: string }[]) => list.map((x) => x.id);

describe('organsOfCard', () => {
  it('uses `sites` first, in their order, whatever the system terms say', () => {
    const c = card('x', ['heart'], [{ organ: 'lung' }, { organ: 'aorta', claim: 'x-c001' }]);
    expect(ids(organsOfCard(c, anatomy))).toEqual(['lung', 'aorta']);
  });
  it('lists an organ once and skips one that anatomy does not know', () => {
    const c = card('x', ['heart'], [{ organ: 'lung', claim: 'x-c001' }, { organ: 'lung', claim: 'x-c002' }, { organ: 'nowhere' }]);
    expect(ids(organsOfCard(c, anatomy))).toEqual(['lung']);
  });
  it('without sites, takes the organs of its system terms, in anatomy order', () => {
    expect(ids(organsOfCard(card('x', ['respiratory', 'heart']), anatomy))).toEqual(['heart', 'heart-valves', 'lung']);
    expect(ids(organsOfCard(card('x', ['heart'], []), anatomy))).toEqual(['heart', 'heart-valves']); // an empty list is no list
  });
  it('gives general and systemic no organ, and keeps the organs of the other terms', () => {
    expect(organsOfCard(card('x', ['general']), anatomy)).toEqual([]);
    expect(organsOfCard(card('x', ['systemic']), anatomy)).toEqual([]);
    expect(ids(organsOfCard(card('x', ['general', 'kidney']), anatomy))).toEqual(['kidney']);
    // even a (wrong) node under `general` is never reached through the system terms
    expect(organsOfCard(card('x', ['general']), [organ('rogue', 'general')])).toEqual([]);
  });
  it('returns the nodes it was given, not copies', () => {
    expect(organsOfCard(card('x', ['kidney']), anatomy)[0]).toBe(anatomy[4]);
  });
});

describe('cardsOfOrgan', () => {
  const cards = [
    card('by-system', ['heart']),
    card('by-site', ['general'], [{ organ: 'heart-valves' }]),
    card('elsewhere', ['heart'], [{ organ: 'lung' }]), // its sites override the system terms
    card('draft', ['heart'], undefined, 'draft'),
    card('general', ['general']),
    card('also-lung', ['respiratory', 'heart']),
  ];
  it('collects the published cards of an organ, by sites or by system term, in the order given', () => {
    expect(ids(cardsOfOrgan('heart', cards, anatomy))).toEqual(['by-system', 'also-lung']);
    expect(ids(cardsOfOrgan('heart-valves', cards, anatomy))).toEqual(['by-system', 'by-site', 'also-lung']);
    expect(ids(cardsOfOrgan('lung', cards, anatomy))).toEqual(['elsewhere', 'also-lung']);
  });
  it('never lists a draft, and an organ without cards or without a node gives an empty list', () => {
    expect(cardsOfOrgan('heart', [card('d', ['heart'], undefined, 'draft')], anatomy)).toEqual([]);
    expect(cardsOfOrgan('kidney', cards, anatomy)).toEqual([]);
    expect(cardsOfOrgan('nowhere', cards, anatomy)).toEqual([]);
  });
  it('returns the cards themselves', () => {
    expect(cardsOfOrgan('lung', cards, anatomy)[0]).toBe(cards[2]);
  });
});

describe('anatomy schema and sites', () => {
  const node = { id: 'aorta', system: 'vessels', label: { it: 'Aorta', en: 'Aorta' }, order: 31 };
  it('defaults aliases and meshes, and rejects an organ under general or systemic, or without both labels', () => {
    expect(anatomySchema.parse(node)).toEqual({ ...node, aliases: { it: [], en: [] }, meshes: [] });
    for (const system of ['general', 'systemic']) expect(anatomySchema.safeParse({ ...node, system }).success).toBe(false);
    expect(anatomySchema.safeParse({ ...node, id: 'Aorta' }).success).toBe(false);
    expect(anatomySchema.safeParse({ ...node, label: { it: 'Aorta' } }).success).toBe(false);
    expect(anatomySchema.safeParse({ ...node, order: 1.5 }).success).toBe(false);
  });
  it('anatomy.yaml is valid', () => {
    const nodes = anatomySchema.array().parse(parse(readFileSync(new URL('../src/content/anatomy.yaml', import.meta.url), 'utf8')));
    expect(new Set(ids(nodes)).size).toBe(nodes.length);
  });
  it('`sites` is optional on an entity: the fixture card has none, and gets an empty list', () => {
    const raw = parse(readFileSync(new URL('../src/content/entities/_fixture-demo/meta.yaml', import.meta.url), 'utf8'));
    expect(entitySchema.parse(raw).sites).toEqual([]);
    const sites = [{ organ: 'heart' }, { organ: 'lung', claim: 'fixture-demo-c001' }];
    expect(entitySchema.parse({ ...raw, sites }).sites).toEqual(sites);
    expect(entitySchema.safeParse({ ...raw, sites: [{ claim: 'fixture-demo-c001' }] }).success).toBe(false); // organ is required
    expect(entitySchema.safeParse({ ...raw, sites: [{ organ: 'Heart' }] }).success).toBe(false); // ids are kebab-case
  });
});
