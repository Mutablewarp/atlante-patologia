import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildBody } from '../scripts/anatomy/build-body.mjs';
import { twoLobesIsthmus } from '../scripts/anatomy/schematic.mjs';

type Box = { min: number[]; max: number[] };
type Organ = { kind: string; of?: string[]; box?: Box; centre?: number[] };
type Manifest = { organs: Record<string, Organ> };

// Frame of spec §4: X left, Y up, Z front.
const X = 0;
const Y = 1;
const Z = 2;

const inside = (p: number[], b: Box) => p.every((v, a) => v >= b.min[a] && v <= b.max[a]);

/** The placement rows of spec §9, as a list of failed rows. */
function placementProblems(m: Manifest): string[] {
  const o = m.organs;
  const rows: [string, boolean][] = [
    // the bones box stands for the pelvis: the uterus sits in its lower 60 %, where the hips are
    ['uterus centre inside the pelvis', inside(o.uterus.centre!, o.bones.box!) && o.uterus.centre![Y] < 0.6 * o.bones.box!.max[Y]],
    ['uterus behind the bladder', o.uterus.centre![Z] < o['urinary-bladder'].centre![Z]],
    ['uterus in front of the rectum', o.uterus.centre![Z] > o['rectum-anal-canal'].centre![Z]],
    ['ovaries lateral to the uterus', o.ovary.box!.min[X] < o.uterus.box!.min[X] && o.ovary.box!.max[X] > o.uterus.box!.max[X]],
    ['breasts in front of the sternum', o.breast.centre![Z] > o.heart.centre![Z] && o.breast.box!.min[Z] > o.heart.box!.min[Z]],
    ['thyroid in front of the trachea', o['thyroid-gland'].centre![Z] > o['trachea-bronchi'].centre![Z]],
    ['thyroid below the thyroid cartilage', o['thyroid-gland'].centre![Y] < o.larynx.centre![Y]],
  ];
  return rows.filter(([, ok]) => !ok).map(([name]) => name);
}

const box = (min: number[], max: number[]): Box => ({ min, max });
const organ = (b: Box, kind = 'mesh'): Organ => ({ kind, box: b, centre: b.min.map((v, a) => (v + b.max[a]) / 2) });

function fixtureManifest(): Manifest {
  return {
    organs: {
      bones: organ(box([-0.2, 0, -0.1], [0.2, 1.7, 0.1])),
      uterus: organ(box([-0.03, 0.85, -0.03], [0.03, 0.93, 0.03])),
      ovary: organ(box([-0.09, 0.87, -0.02], [0.09, 0.91, 0.02])),
      'urinary-bladder': organ(box([-0.04, 0.8, 0.03], [0.04, 0.88, 0.09])),
      'rectum-anal-canal': organ(box([-0.03, 0.78, -0.09], [0.03, 0.9, -0.04])),
      heart: organ(box([-0.05, 1.2, -0.04], [0.1, 1.35, 0.05])),
      breast: organ(box([-0.15, 1.2, 0.06], [0.15, 1.35, 0.14])),
      'trachea-bronchi': organ(box([-0.01, 1.3, -0.03], [0.01, 1.52, -0.01])),
      larynx: organ(box([-0.02, 1.5, -0.02], [0.02, 1.58, 0.02])),
      'thyroid-gland': organ(box([-0.03, 1.46, -0.01], [0.03, 1.5, 0.01]), 'schematic'),
    },
  };
}

describe('twoLobesIsthmus', () => {
  const anchors = { cartilage: box([-0.02, 1.5, -0.02], [0.02, 1.58, 0.02]), trachea: box([-0.01, 1.3, -0.03], [0.01, 1.5, -0.01]) };
  const mesh = twoLobesIsthmus(anchors);

  it('is a closed-size mesh of about 320 triangles', () => {
    expect(mesh.indices.length / 3).toBeGreaterThan(280);
    expect(mesh.indices.length / 3).toBeLessThan(360);
    expect(Math.max(...mesh.indices)).toBeLessThan(mesh.positions.length / 3);
  });

  it('sits in front of the trachea and below the thyroid cartilage, symmetric on X', () => {
    let lo = [Infinity, Infinity, Infinity];
    let hi = [-Infinity, -Infinity, -Infinity];
    for (let k = 0; k < mesh.positions.length; k += 3) {
      for (let a = 0; a < 3; a += 1) {
        lo[a] = Math.min(lo[a], mesh.positions[k + a]);
        hi[a] = Math.max(hi[a], mesh.positions[k + a]);
      }
    }
    expect((lo[Z] + hi[Z]) / 2).toBeGreaterThan(anchors.trachea.max[Z]);
    expect(hi[Y]).toBeLessThanOrEqual(anchors.cartilage.min[Y] + 0.01);
    expect(lo[X] + hi[X]).toBeCloseTo(0, 5);
  });

  it('is sized from the trachea width', () => {
    const wide = twoLobesIsthmus({ ...anchors, trachea: box([-0.02, 1.3, -0.03], [0.02, 1.5, -0.01]) });
    const span = (m: { positions: Float32Array }) => Math.max(...m.positions.filter((_, k) => k % 3 === X)) * 2;
    expect(span(wide)).toBeCloseTo(span(mesh) * 2, 4);
  });
});

describe('placement rows (fixture manifest)', () => {
  it('passes on a well-placed body', () => expect(placementProblems(fixtureManifest())).toEqual([]));

  it('names a uterus in front of the bladder', () => {
    const m = fixtureManifest();
    m.organs.uterus = organ(box([-0.03, 0.85, 0.05], [0.03, 0.93, 0.11]));
    expect(placementProblems(m)).toContain('uterus behind the bladder');
  });

  it('names a thyroid above the cartilage', () => {
    const m = fixtureManifest();
    m.organs['thyroid-gland'] = organ(box([-0.03, 1.6, -0.01], [0.03, 1.64, 0.01]), 'schematic');
    expect(placementProblems(m)).toContain('thyroid below the thyroid cartilage');
  });
});

describe('build with a schematic organ', () => {
  it('writes the thyroid into its system with a box, and proxies and none with `of` and no box', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'anatomy-placement-'));
    const raw = join(dir, 'raw');
    const tables = join(dir, 'tables');
    mkdirSync(join(raw, 'isa_obj'), { recursive: true });
    mkdirSync(tables);
    // source frame: mm, Z up, front -Y
    writeFileSync(join(raw, 'isa_obj', 'S.obj'), 'v -200 -100 0\nv 200 -100 0\nv 200 100 1700\nv -200 100 1700\nf 1 2 3 4');
    writeFileSync(join(raw, 'isa_obj', 'C.obj'), 'v -20 -10 1500\nv 20 -10 1500\nv 20 10 1580\nv -20 10 1580\nf 1 2 3 4');
    writeFileSync(join(raw, 'isa_obj', 'T.obj'), 'v -10 -10 1300\nv 10 -10 1300\nv 10 10 1500\nv -10 10 1500\nf 1 2 3 4');
    writeFileSync(join(tables, 'partof_parts_list_e.txt'), 'c\tr\ten\nF1\tB\tskin\nF3\tB\ttrachea\n');
    writeFileSync(join(tables, 'partof_element_parts.txt'), 'c\tn\te\nF1\tskin\tS\nF3\ttrachea\tT\n');
    writeFileSync(join(tables, 'isa_parts_list_e.txt'), 'c\tr\ten\nF2\tB\tthyroid cartilage\n');
    writeFileSync(join(tables, 'isa_element_parts.txt'), 'c\tn\te\nF2\tthyroid cartilage\tC\n');
    const map = join(dir, 'map.yaml');
    const organs = [
      'skin: { kind: mesh, concepts: [skin] }',
      'thyroid-gland: { kind: schematic, shape: two-lobes-isthmus, anchors: ["isa:thyroid cartilage", trachea] }',
      'parathyroid-glands: { kind: proxy, of: [thyroid-gland] }',
      'lymph-nodes: { kind: none }',
    ];
    writeFileSync(map, `shell: { concepts: [skin] }\norgans:\n  ${organs.join('\n  ')}\n`);
    const anatomy = join(dir, 'anatomy.yaml');
    writeFileSync(anatomy, ['skin', 'thyroid-gland', 'parathyroid-glands', 'lymph-nodes'].map((id) => `- { id: ${id}, system: ${id === 'skin' ? 'skin' : 'endocrine'} }`).join('\n'));

    const out = join(dir, 'out');
    const manifest = await buildBody({ raw, tables, out, map, anatomy, targets: { shell: 10 } });
    expect(existsSync(join(out, 'endocrine.glb'))).toBe(true);
    expect(manifest.systems.endocrine.organs).toEqual(['thyroid-gland']);
    const thyroid = manifest.organs['thyroid-gland'];
    expect(thyroid.kind).toBe('schematic');
    expect(thyroid.box.min).toHaveLength(3);
    expect(thyroid.centre[Z]).toBeGreaterThan(manifest.organs.skin.box.min[Z]);
    expect(manifest.organs['parathyroid-glands']).toEqual({ system: 'endocrine', kind: 'proxy', of: ['thyroid-gland'], inside: null });
    expect(manifest.organs['lymph-nodes'].box).toBeUndefined();
  });
});

const REAL = 'public/anatomy/manifest.json';
describe.skipIf(!existsSync(REAL))('placement on the real build', () => {
  const manifest = (): Manifest => JSON.parse(readFileSync(REAL, 'utf8'));

  it('puts the organs where spec §9 says', () => expect(placementProblems(manifest())).toEqual([]));

  it('gives every proxy and none an `of` list and no box', () => {
    for (const [id, o] of Object.entries(manifest().organs)) {
      if (o.kind === 'proxy') expect(o.of?.length, id).toBeGreaterThan(0);
      if (o.kind === 'proxy' || o.kind === 'none') expect(o.box, id).toBeUndefined();
    }
  });

  it('marks the thyroid schematic, with a box', () => {
    const t = manifest().organs['thyroid-gland'];
    expect(t.kind).toBe('schematic');
    expect(t.box).toBeDefined();
  });
});
