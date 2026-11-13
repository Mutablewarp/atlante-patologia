import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { MODULE_SYSTEM, bodyTree, cardsOfOrgan, organsOfCard, type AnatomyCard } from '../src/lib/anatomy.ts';
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

describe('bodyTree', () => {
  const systems = [
    { id: 'general', order: 10, label: { it: 'Generale', en: 'General' } },
    { id: 'heart', order: 40, label: { it: 'Cuore', en: 'Heart' } },
    { id: 'vessels', order: 30, label: { it: 'Vasi', en: 'Vessels' } },
    { id: 'respiratory', order: 50, label: { it: 'Respiratorio', en: 'Respiratory' } },
  ];
  const processes = [
    { id: 'ischemia', order: 2, label: { it: 'Ischemia', en: 'Ischemia' } },
    { id: 'neoplasia', order: 1, label: { it: 'Neoplasia', en: 'Neoplasia' } },
  ];
  const organs = [
    { id: 'heart', system: 'heart', order: 41, label: { it: 'Cuore', en: 'Heart' } },
    { id: 'heart-valves', system: 'heart', order: 42, label: { it: 'Valvole', en: 'Heart valves' } },
    { id: 'aorta', system: 'vessels', order: 31, label: { it: 'Aorta', en: 'Aorta' } },
  ];
  const modules = [
    { id: 'o16', planned: [{ id: 'aneurysm', names: { it: 'Aneurisma', en: 'Aneurysm' } }, { id: 'vasculitis', names: { it: 'Vasculite', en: 'Vasculitis' } }] },
    { id: 'o17', planned: [{ id: 'mi', names: { it: 'Infarto', en: 'Infarct' } }] },
    { id: 'g01', planned: [{ id: 'ignored', names: { it: 'x', en: 'x' } }] },
  ];
  const ent = (id: string, system: string[], process: string[], extra: object = {}) => ({
    id,
    status: 'published' as const,
    names: { it: `${id}-it`, en: `${id}-en` },
    lenses: { system, process },
    ...extra,
  });
  const entities = [
    ent('mi', ['heart'], ['ischemia']),
    ent('cardiac-tumor', ['heart'], ['neoplasia', 'ischemia']),
    ent('valve-calc', ['general'], [], { sites: [{ organ: 'heart-valves' }, { organ: 'heart' }] }),
    ent('aortic-tumor', ['vessels'], ['neoplasia']),
    ent('necrosis', ['general'], ['ischemia']),
    { ...ent('draft-card', ['heart'], ['ischemia']), status: 'draft' as const },
  ];
  const tree = bodyTree({ entities, anatomy: organs, systems, processes, modules, lang: 'en' });
  const sys = (id: string) => tree.systems.find((s) => s.id === id)!;

  it('lists the systems of the tree in their order, never general or systemic', () => {
    expect(tree.systems.map((s) => s.id)).toEqual(['vessels', 'heart', 'respiratory']);
    expect(sys('heart').label).toBe('Heart');
  });
  it('lists organs in order, with groups by first process and cards in the order given', () => {
    const heart = sys('heart').organs;
    expect(heart.map((o) => o.id)).toEqual(['heart', 'heart-valves']);
    expect(heart[0].groups.map((g) => g.process)).toEqual(['neoplasia', 'ischemia', '']);
    expect(heart[0].groups[1].cards).toEqual([{ id: 'mi', name: 'mi-en' }]);
    expect(heart[0].groups[0].cards).toEqual([{ id: 'cardiac-tumor', name: 'cardiac-tumor-en' }]);
    expect(heart[0].groups[2]).toEqual({ process: '', label: '', cards: [{ id: 'valve-calc', name: 'valve-calc-en' }] });
    expect(heart[0].groups[1].label).toBe('Ischemia');
  });
  it('counts distinct published cards per organ and per system', () => {
    expect(sys('heart').organs.map((o) => o.count)).toEqual([3, 3]); // a card without sites sits in every organ of its system
    expect(sys('heart').count).toBe(3); // distinct: each card counts once for the system
    expect(sys('vessels').count).toBe(1);
    expect(sys('respiratory')).toMatchObject({ count: 0, organs: [] });
  });
  it('lists the planned entries of the system module that are not published', () => {
    expect(sys('vessels').planned).toEqual([{ id: 'aneurysm', name: 'Aneurysm' }, { id: 'vasculitis', name: 'Vasculitis' }]);
    expect(sys('heart').planned).toEqual([]); // `mi` is published
    expect(sys('respiratory').planned).toEqual([]);
  });
  it('counts the published cards that map to no organ', () => {
    expect(tree.unplaced).toBe(1);
  });
  it('uses the names of the language asked', () => {
    const it = bodyTree({ entities, anatomy: organs, systems, processes, modules, lang: 'it' });
    expect(it.systems[1].organs[0].label).toBe('Cuore');
    expect(it.systems[0].planned[0].name).toBe('Aneurisma');
  });
});

describe('MODULE_SYSTEM on the real files', () => {
  const read = (p: string) => parse(readFileSync(p, 'utf8'));
  const moduleIds = new Set((read('src/content/modules.yaml') as { id: string }[]).map((m) => m.id));
  const terms = new Set((read('src/content/taxonomy/system.yaml') as { terms: { id: string }[] }).terms.map((t) => t.id));
  it('maps the 18 modules o16..o33 to existing system terms', () => {
    expect(Object.keys(MODULE_SYSTEM)).toHaveLength(18);
    for (const [m, s] of Object.entries(MODULE_SYSTEM)) {
      expect(moduleIds.has(m), m).toBe(true);
      expect(terms.has(s), s).toBe(true);
    }
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
